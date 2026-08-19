/** Reveal-on-scroll for non-pinned brand sections — GSAP ScrollTrigger when
 *  available (loaded as classic globals in index.html), plain
 *  IntersectionObserver fallback otherwise. */
export function initReveal() {
  const els = [...document.querySelectorAll("[data-reveal]")];
  if (!els.length) return;

  if (window.gsap && window.ScrollTrigger) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    els.forEach((el, i) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 28 },
        {
          opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" },
        }
      );
    });
    return;
  }

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
    { threshold: 0.16 }
  );
  els.forEach((el) => io.observe(el));
  const revealNow = () => {
    els.forEach((el) => {
      if (el.classList.contains("in")) return;
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.94 && r.bottom > 0) el.classList.add("in");
    });
  };
  addEventListener("scroll", revealNow, { passive: true });
  revealNow();
}
