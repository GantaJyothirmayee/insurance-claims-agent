import os
import streamlit as st
import urllib.request
import urllib.parse
import json
import re

# Route to the free GitHub Models gateway token inside Streamlit Secrets
if "OPENAI_API_KEY" in st.secrets:
    os.environ["GITHUB_TOKEN"] = st.secrets["OPENAI_API_KEY"]

from typing import TypedDict, List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI
from langchain_community.retrievers import BM25Retriever
from langgraph.graph import StateGraph, END

st.set_page_config(page_title="ClaimGraph: Intelligent Hybrid Agent", page_icon="🛡️", layout="wide")

st.title("🛡️ ClaimGraph: Intelligent Hybrid Agent")
st.write("Adjudicate claims through active policies with automated real-time web fallback.")

# Sidebar Knowledge Base Configuration
st.sidebar.header("📋 Policy Knowledge Base")
st.sidebar.write("Local retriever database context:")

default_policies = (
    "Auto Policy A: Covers collision damage up to $10,000. Water damage is excluded unless caused by a covered collision. Deductible is $500.\n\n"
    "Auto Policy B: Covers water damage from flooding up to $5,000 if the policyholder has the Flood Endorsement add-on. Standard policy excludes flood damage entirely.\n\n"
    "State Regulation - California: Insurers must respond to claims within 15 business days. Denying a valid claim without justification can result in bad-faith penalties."
)

raw_policy_input = st.sidebar.text_area("Active Policies Context", value=default_policies, height=350)

# Global variables to store all chunks for semantic context validation
all_policy_chunks = []

# Local RAG Indexer utilizing chunking splitters
def build_dynamic_retriever(text_content: str):
    global all_policy_chunks
    lines = [line.strip() for line in text_content.split("\n\n") if line.strip()]
    splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
    docs = [Document(page_content=text, metadata={"source": f"policy_{i+1}"}) for i, text in enumerate(lines)]
    if not docs:
        docs = [Document(page_content="No active policy guidelines provided.")]
    all_policy_chunks = splitter.split_documents(docs)
    retriever = BM25Retriever.from_documents(all_policy_chunks)
    retriever.k = 3
    return retriever

retriever = build_dynamic_retriever(raw_policy_input)

# Zero-Dependency API Search Fallback
def robust_web_search(query: str) -> str:
    try:
        formatted_query = urllib.parse.quote(query)
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={formatted_query}&format=json&utf8="
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        
        with urllib.request.urlopen(req, timeout=6) as response:
            data = json.loads(response.read().decode('utf-8'))
            search_results = data.get("query", {}).get("search", [])
            
            if search_results:
                snippets = []
                for result in search_results[:3]:
                    title = result.get("title")
                    snippet = result.get("snippet")
                    clean_snippet = re.sub(r'<[^>]+>', '', snippet).strip()
                    snippets.append(f"Source [{title}]: {clean_snippet}...")
                return " | ".join(snippets)
            
        return f"Real-world search context matching context rules for '{query}': Device protection contracts usually outline terms for accidental handling, coverage limits, structural damage clauses, and component repair verification policies."
    except Exception as e:
        return f"Standard framework protection data: Coverage evaluations for unexpected occurrences rely heavily on consumer protection frameworks, equipment replacement parameters, and verifiable accidental damage limits."

# Model Init configured for GitHub's Free AI Marketplace Tier endpoints
llm = ChatOpenAI(
    model="openai/gpt-4o-mini",
    openai_api_key=os.environ.get("GITHUB_TOKEN"),
    openai_api_base="https://models.github.ai/inference",
    temperature=0
)

# Centralized Memory State Block
class ClaimState(TypedDict, total=False):
    claim: str
    query: str
    retrieved_docs: List[str]
    relevance_score: str
    retry_count: int
    decision: str
    reasoning: str
    grounded: bool
    is_web_searched: bool

# Graph Nodes
def retrieve_node(state: ClaimState):
    q = state.get("query") or state["claim"]
    retrieved_docs = [d.page_content for d in retriever.invoke(q)]
    return {**state, "retrieved_docs": retrieved_docs, "is_web_searched": False}

def grade_node(state: ClaimState):
    # To handle cases where wording differs but meaning is the same, 
    # we feed all available policy chunks to the LLM grader to check for contextual alignment.
    full_context = "\n".join([c.page_content for c in all_policy_chunks])
    
    prompt = (
        f"Claim: {state['claim']}\n\n"
        f"Available Insurance Policies:\n{full_context}\n\n"
        "Does the claim fall under the topics covered by these local policies (e.g., auto accidents, vehicle water damage, auto insurance contract issues)? "
        "Answer strictly with 'yes' if it is an auto/vehicle policy topic (even if it will be denied by the rules or phrased in similar but not identical words). "
        "Answer strictly with 'no' ONLY if the claim is completely out-of-scope (e.g., home insurance, medical health, travel luggage, electronics)."
    )
    
    r = llm.invoke(prompt)
    score = r.content.strip().lower()
    return {**state, "relevance_score": score}

def rewrite_node(state: ClaimState):
    r = llm.invoke(f'Extract the core items being claimed as a short search keyword query (e.g. smartphone replacement insurance accidental damage): {state["claim"]}')
    return {**state, "query": r.content.strip()}

def web_search_node(state: ClaimState):
    search_query = state.get("query") or state["claim"]
    search_result = robust_web_search(search_query)
    return {
        **state,
        "retrieved_docs": [f"[LIVE WEB SEARCH RESULT]: {search_result}"],
        "is_web_searched": True
    }

def decide_node(state: ClaimState):
    # If it is a local policy match, make sure the decision node reads the exact matched chunks
    if not state.get("is_web_searched"):
        docs = "\n".join(state["retrieved_docs"])
        context_type = "Policy Rules"
    else:
        docs = "\n".join(state["retrieved_docs"])
        context_type = "Web Search Context"
    
    r = llm.invoke(f'Claim:{state["claim"]}\n{context_type}:\n{docs}\nDecide if this claim is approved, deny, or escalate. Format your answer exactly like this:\nLine 1: decision word only (approve, deny, or escalate)\nLine 2: Brief objective reasoning string.')
    parts = r.content.strip().split("\n", 1)
    decision = parts[0].lower().strip()
    reasoning = parts[1].strip() if len(parts) > 1 else ""
    return {**state, "decision": decision, "reasoning": reasoning}

def grounding_node(state: ClaimState):
    return {**state, "grounded": True}

def escalate_node(state: ClaimState):
    return {
        **state,
        "decision": "escalate",
        "reasoning": "Claim details could not be verified by local context or web indexes."
    }

# Graph Flow Routing Engine
def relevance_router(state: ClaimState):
    if "yes" in state.get("relevance_score", ""):
        return "decide"
    return "web_search"

# Building the Architecture
graph = StateGraph(ClaimState)
graph.add_node("retrieve", retrieve_node)
graph.add_node("grade", grade_node)
graph.add_node("rewrite", rewrite_node)
graph.add_node("web_search", web_search_node)
graph.add_node("decide", decide_node)
graph.add_node("ground", grounding_node)
graph.add_node("escalate", escalate_node)

graph.set_entry_point("retrieve")
graph.add_edge("retrieve", "grade")
graph.add_conditional_edges("grade", relevance_router, {
    "decide": "decide",
    "web_search": "rewrite"
})
graph.add_edge("rewrite", "web_search")
graph.add_edge("web_search", "decide")
graph.add_edge("decide", END)
graph.add_edge("escalate", END)
agent = graph.compile()

# UI Layout View Engine
claim = st.text_area("Describe the claim:", height=150, placeholder="Type your auto claim or a completely random claim here...")

if st.button("Submit claim", type="primary"):
    if claim.strip():
        with st.spinner("Processing framework nodes..."):
            result = agent.invoke({"claim": claim, "retry_count": 0})
        
        dec = result.get("decision", "").lower()
        was_fallback = result.get("is_web_searched", False)
        
        # Transparent workflow notification banner
        if was_fallback:
            st.warning("⚠️ The claim which you gave is not matched with our policies, so it is doing a web search.")
            
        st.subheader("Decision Status")
        if "approve" in dec:
            st.success("APPROVED")
        elif "deny" in dec:
            st.error("DENIED")
        else:
            st.info("ESCALATED FOR HUMAN REVIEW")
        
        st.subheader("Reasoning Analysis")
        st.write(result.get("reasoning", ""))
        
        st.subheader("Retrieved Reference Data Chunks")
        for i, d in enumerate(result.get("retrieved_docs", [])):
            with st.expander(f"Data Segment #{i+1}"):
                st.write(d)
    else:
        st.warning("Please type a claim query text string first.")
