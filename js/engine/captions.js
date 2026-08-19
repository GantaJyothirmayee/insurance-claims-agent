/** Shared caption fade/parallax math for pinned scroll stages. */
function transformBase(el) {
  if (el.classList.contains("cap-center")) return "translate(-50%, -50%)";
  if (el.classList.contains("cap-top") || el.classList.contains("cap-bottom")) return "translateX(-50%)";
  return "translateY(-50%)";
}

export function updateCaptions(captionEls, p) {
  for (const el of captionEls) {
    const tIn = +el.dataset.in, tHold = +el.dataset.hold, tOut = +el.dataset.out;
    if (Number.isNaN(tIn)) continue;
    const rise = Math.max((tHold - tIn) * 0.4, 0.008);
    const fall = Math.max((tOut - tHold) * 0.6, 0.008);
    let o = 0;
    if (p >= tIn && p <= tOut) {
      o = Math.min((p - tIn) / rise, 1) * Math.min((tOut - p) / fall, 1);
      o = Math.min(Math.max(o, 0), 1);
    }
    el.style.opacity = o.toFixed(3);
    const drift = (p - tHold) * -36;
    const base = el.dataset._base || (el.dataset._base = transformBase(el));
    el.style.transform = `${base} translateY(${drift.toFixed(1)}px)`;
  }
}

export function bindScrollCue(trackEl, cueEl, hideAfter = 0.02) {
  const onScroll = () => {
    const rect = trackEl.getBoundingClientRect();
    const max = trackEl.offsetHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, -rect.top / max)) : 0;
    cueEl.style.opacity = p < hideAfter ? "1" : "0";
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
