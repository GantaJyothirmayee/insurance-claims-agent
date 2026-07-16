import os
import streamlit as st

# We read your GitHub token from the same Secrets variable
if "OPENAI_API_KEY" in st.secrets:
    os.environ["GITHUB_TOKEN"] = st.secrets["OPENAI_API_KEY"]

from typing import TypedDict, List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI
from langchain_community.retrievers import BM25Retriever
from langgraph.graph import StateGraph, END

st.set_page_config(page_title="Insurance Claims Agent", page_icon="🛡️", layout="wide")

st.title("🛡️ Insurance Claims Adjudication Agent")
st.write("Enter a claim and let the LangGraph agent analyze it.")

policies = [
    {"id":"policy_1","text":"Auto Policy A: Covers collision damage up to $10,000. Water damage is excluded unless caused by a covered collision. Deductible is $500."},
    {"id":"policy_2","text":"Auto Policy B: Covers water damage from flooding up to $5,000 if the policyholder has the Flood Endorsement add-on. Standard policy excludes flood damage entirely."},
    {"id":"policy_3","text":"State Regulation - California: Insurers must respond to claims within 15 business days. Denying a valid claim without justification can result in bad-faith penalties."},
]

@st.cache_resource
def build_retriever():
    splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
    docs = [Document(page_content=p["text"], metadata={"source": p["id"]}) for p in policies]
    chunks = splitter.split_documents(docs)
    retriever = BM25Retriever.from_documents(chunks)
    retriever.k = 3
    return retriever

retriever = build_retriever()

# Directing the LLM to use GitHub's free AI hosting gateway!
llm = ChatOpenAI(
    model="gpt-4o-mini",
    openai_api_key=os.environ.get("GITHUB_TOKEN"),
    openai_api_base="https://models.inference.ai.azure.com",
    temperature=0
)

class ClaimState(TypedDict, total=False):
    claim: str
    query: str
    retrieved_docs: List[str]
    relevance_score: str
    retry_count: int
    decision: str
    reasoning: str
    grounded: bool

def retrieve_node(state: ClaimState):
    q = state.get("query") or state["claim"]
    retrieved_docs = [d.page_content for d in retriever.invoke(q)]
    return {**state, "retrieved_docs": retrieved_docs}

def grade_node(state: ClaimState):
    docs = "\n".join(state["retrieved_docs"])
    r = llm.invoke(f'Claim:{state["claim"]}\nPolicy:{docs}\nDoes policy contain enough info? Answer yes or no.')
    score = r.content.strip().lower()
    return {**state, "relevance_score": score}

def rewrite_node(state: ClaimState):
    r = llm.invoke(f'Rewrite search query for claim: {state["claim"]}')
    query = r.content.strip()
    retry_count = state.get("retry_count", 0) + 1
    return {**state, "query": query, "retry_count": retry_count}

def decide_node(state: ClaimState):
    docs = "\n".join(state["retrieved_docs"])
    r = llm.invoke(f'Claim:{state["claim"]}\nPolicy:{docs}\nDecide approve, deny or escalate. First line decision, second line reason.')
    parts = r.content.strip().split("\n", 1)
    decision = parts[0].lower()
    reasoning = parts[1] if len(parts) > 1 else ""
    return {**state, "decision": decision, "reasoning": reasoning}

def grounding_node(state: ClaimState):
    docs = "\n".join(state["retrieved_docs"])
    r = llm.invoke(f'Reasoning:{state["reasoning"]}\nPolicy:{docs}\nGrounded? yes or no')
    grounded = "yes" in r.content.lower()
    return {**state, "grounded": grounded}

def escalate_node(state: ClaimState):
    return {
        **state,
        "decision": "escalate",
        "reasoning": "Insufficient or ungrounded evidence. Escalated to a human adjuster."
    }

MAX_RETRIES = 2
def relevance_router(state: ClaimState):
    if "yes" in state.get("relevance_score", ""):
        return "decide"
    if state.get("retry_count", 0) >= MAX_RETRIES:
        return "escalate"
    return "rewrite"

def grounding_router(state: ClaimState):
    return "end" if state.get("grounded", False) else "escalate"

graph = StateGraph(ClaimState)
graph.add_node("retrieve", retrieve_node)
graph.add_node("grade", grade_node)
graph.add_node("rewrite", rewrite_node)
graph.add_node("decide", decide_node)
graph.add_node("ground", grounding_node)
graph.add_node("escalate", escalate_node)

graph.set_entry_point("retrieve")
graph.add_edge("retrieve", "grade")
graph.add_conditional_edges("grade", relevance_router, {
    "decide": "decide", "rewrite": "rewrite", "escalate": "escalate"
})
graph.add_edge("rewrite", "retrieve")
graph.add_edge("decide", "ground")
graph.add_conditional_edges("ground", grounding_router, {
    "end": END, "escalate": "escalate"
})
graph.add_edge("escalate", END)
agent = graph.compile()

claim = st.text_area("Enter insurance claim", height=150)

if st.button("Analyze Claim"):
    if claim.strip():
        with st.spinner("Analyzing..."):
            result = agent.invoke({"claim": claim, "retry_count": 0})
        
        st.subheader("Decision")
        st.success(result.get("decision", "").upper())
        
        st.subheader("Reasoning")
        st.write(result.get("reasoning", ""))
        
        st.subheader("Retrieved Policy Chunks")
        for d in result.get("retrieved_docs", []):
            st.code(d)
    else:
        st.warning("Please enter a claim.")
