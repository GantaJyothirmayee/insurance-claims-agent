/** Contact Express — tier picker + mailto submit. No backend by design:
 *  submitting opens the visitor's email client with a pre-filled message. */
export function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const pills = [...form.querySelectorAll(".tier-pill")];
  const message = document.getElementById("contact-message");
  let tier = "";

  pills.forEach((p) => {
    p.addEventListener("click", () => {
      const already = p.classList.contains("active");
      pills.forEach((o) => o.classList.remove("active"));
      if (!already) {
        p.classList.add("active");
        tier = p.dataset.tier;
      } else {
        tier = "";
      }
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`New project inquiry${tier ? ` — ${tier}` : ""}`);
    const bodyLines = [tier ? `Plan of interest: ${tier}` : "", "", message.value.trim()].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join("\n"));
    window.location.href = `mailto:hello@soli.studio?subject=${subject}&body=${body}`;
  });
}
