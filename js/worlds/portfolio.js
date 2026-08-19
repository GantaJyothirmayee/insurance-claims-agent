import * as THREE from "three";
import { GLRig } from "../engine/glRig.js";
import { driveTrack } from "../engine/scrollDriver.js";

const PROJECTS = [
  { label: "Branding — 01", sub: "Visual identity system", a: "#70fbff", b: "#0a0a0c" },
  { label: "Social — 02", sub: "Campaign content design", a: "#ac7de6", b: "#0a0a0c" },
  { label: "Marketing — 03", sub: "Launch creative set", a: "#eba6fc", b: "#0a0a0c" },
  { label: "Product — 04", sub: "Product visualization", a: "#ef669c", b: "#0a0a0c" },
  { label: "Identity — 05", sub: "Logo & brand system", a: "#70fbff", b: "#ac7de6" },
  { label: "Direction — 06", sub: "Art direction & style", a: "#ef669c", b: "#eba6fc" },
];

function placeholderTexture(item) {
  const w = 1024, h = 640;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, item.a); g.addColorStop(1, item.b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // frosted overlay
  ctx.fillStyle = "rgba(5,5,5,0.45)";
  ctx.fillRect(0, 0, w, h);
  // subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // label
  ctx.fillStyle = "rgba(244,241,236,0.92)";
  ctx.font = "600 40px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(item.label, w / 2, h / 2 - 6);
  ctx.font = "400 20px Sora, sans-serif";
  ctx.fillStyle = "rgba(244,241,236,0.55)";
  ctx.fillText(item.sub, w / 2, h / 2 + 32);
  ctx.font = "500 13px Sora, sans-serif";
  ctx.fillStyle = "rgba(244,241,236,0.35)";
  ctx.fillText("PLACEHOLDER — AWAITING PROJECT ARTWORK", w / 2, h - 34);
  return new THREE.CanvasTexture(c);
}

export function initPortfolio() {
  const track = document.getElementById("portfolio-track");
  const canvas = document.getElementById("portfolio-canvas");
  const labelEl = document.getElementById("portfolio-label-text");
  if (!track || !canvas) return;

  const rig = new GLRig(canvas, { bloom: true, bloomStrength: 0.5, bloomRadius: 0.4, bloomThreshold: 0.35, bg: "#050505" });
  rig.scene.fog = new THREE.Fog(0x050505, 4, 15);
  rig.camera.position.set(0, 0, 3);

  const SPACING = 4.2;
  const panels = PROJECTS.map((item, i) => {
    const tex = placeholderTexture(item);
    const geo = new THREE.PlaneGeometry(2.6, 1.62);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    const side = i % 2 === 0 ? -1 : 1;
    mesh.position.set(side * (1.1 + Math.random() * 0.6), (Math.random() - 0.5) * 0.8, -i * SPACING);
    mesh.rotation.y = -side * 0.32;
    rig.scene.add(mesh);
    return mesh;
  });

  // ambient glow orbs for atmosphere
  const orbGeo = new THREE.SphereGeometry(0.05, 8, 8);
  for (let i = 0; i < 40; i++) {
    const c = [0x70fbff, 0xac7de6, 0xeba6fc, 0xef669c][i % 4];
    const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5 }));
    orb.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, -Math.random() * SPACING * PROJECTS.length);
    rig.scene.add(orb);
  }

  let lastIdx = -1;
  const stop = driveTrack(track, ({ t, progress, pointer }) => {
    const z = 2 - progress * (SPACING * (PROJECTS.length - 0.4));
    rig.camera.position.z = z;
    rig.camera.position.x = Math.sin(t * 0.08) * 0.2 + pointer.x * 0.5;
    rig.camera.position.y = Math.cos(t * 0.06) * 0.1 - pointer.y * 0.3;
    rig.camera.lookAt(0, 0, z - 4);

    panels.forEach((m) => { m.lookAt(rig.camera.position.x, rig.camera.position.y, rig.camera.position.z); });

    const idx = Math.max(0, Math.min(PROJECTS.length - 1, Math.round(progress * (PROJECTS.length - 1))));
    if (idx !== lastIdx && labelEl) { labelEl.textContent = `${PROJECTS[idx].label} — ${PROJECTS[idx].sub}`; lastIdx = idx; }

    rig.render();
  });

  return stop;
}
