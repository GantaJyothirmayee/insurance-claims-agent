/** Sticky nav — fades in once the hero film has scrolled past. */
export function initNav() {
  const nav = document.getElementById("nav");
  const hero = document.getElementById("hero-track");
  if (!nav || !hero) return;

  const threshold = () => hero.offsetHeight - window.innerHeight * 0.6;
  const onScroll = () => nav.classList.toggle("on", window.scrollY > threshold());
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.querySelectorAll('#nav a.navlink[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const el = document.querySelector(a.getAttribute("href"));
      if (el) {
        e.preventDefault();
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 40, behavior: "smooth" });
      }
    });
  });
}
