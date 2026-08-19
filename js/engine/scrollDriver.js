import { updatePointer } from "./pointer.js";

/** progress ∈ [0,1] of a track element's pinned scroll range. */
export function trackProgress(trackEl) {
  const rect = trackEl.getBoundingClientRect();
  const max = trackEl.offsetHeight - window.innerHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, -rect.top / max));
}

/**
 * Drives a per-frame callback with smoothed scroll progress + pointer,
 * only while the track is anywhere near the viewport (perf: WebGL scenes
 * off-screen stop rendering).
 */
export function driveTrack(trackEl, onFrame) {
  let raf = null;
  let smooth = 0;
  const clock = { t: 0, last: performance.now() };
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries[0].isIntersecting;
      if (visible && !raf) {
        clock.last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    },
    { rootMargin: "20% 0px 20% 0px" }
  );
  io.observe(trackEl);

  function tick(now) {
    const dt = Math.min((now - clock.last) / 1000, 0.5) || 0.016;
    clock.last = now; clock.t += dt;
    const target = trackProgress(trackEl);
    const k = 1 - Math.exp(-dt * 10);
    smooth += (target - smooth) * k;
    if (Math.abs(target - smooth) < 0.0015) smooth = target;
    const p = updatePointer();
    onFrame({ t: clock.t, dt, progress: smooth, rawProgress: target, pointer: p });
    raf = requestAnimationFrame(tick);
  }

  return () => { if (raf) cancelAnimationFrame(raf); io.disconnect(); };
}
