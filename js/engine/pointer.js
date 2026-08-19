/** Global smoothed pointer position in [-1, 1], for mouse-parallax across sections. */
export const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

window.addEventListener("pointermove", (e) => {
  pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
}, { passive: true });

// devices without a real pointer (touch-only): keep pointer centered
window.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") { pointer.tx = 0; pointer.ty = 0; }
});

export function updatePointer(damping = 0.06) {
  pointer.x += (pointer.tx - pointer.x) * damping;
  pointer.y += (pointer.ty - pointer.y) * damping;
  return pointer;
}
