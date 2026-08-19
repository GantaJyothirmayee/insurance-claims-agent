import { initNav } from "./engine/nav.js";
import { initReveal } from "./engine/reveal.js";
import { initContactForm } from "./engine/contactForm.js";
import { initHero } from "./worlds/hero.js";
import { initProject } from "./worlds/project.js";
import { initCta } from "./worlds/cta.js";
import { initWhoWeAre } from "./worlds/whoWeAre.js";
import { initPassSoli } from "./worlds/passSoli.js";
import { initStartPlus } from "./worlds/startPlus.js";
import { initProcess } from "./worlds/process.js";
import { initPortfolio } from "./worlds/portfolio.js";

const loader = document.getElementById("loader");
const loadbar = document.getElementById("loadbar");

function markDone() {
  loader?.classList.add("done");
}

initHero({
  onLoadProgress: (frac) => { if (loadbar) loadbar.style.width = `${Math.round(frac * 100)}%`; },
  onReady: markDone,
});

// safety: never let the loader block forever (slow network / decode edge case)
setTimeout(markDone, 6000);

initProject();
initCta();
initWhoWeAre();
initPassSoli();
initStartPlus();
initProcess();
initPortfolio();

initNav();
initReveal();
initContactForm();
