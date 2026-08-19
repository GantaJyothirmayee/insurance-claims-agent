import * as THREE from "three";
import { GLRig } from "../engine/glRig.js";
import { driveTrack } from "../engine/scrollDriver.js";
import { updateCaptions } from "../engine/captions.js";
import { makeGlowSprite, dotAlphaTexture, band } from "../engine/sceneKit.js";

/** Tiny canvas "hologram schematic" — grid + a few glowing readout bars. */
function holoTexture(hex) {
  const w = 256, h = 160;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = hex + "55";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = hex;
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = hex;
  const bars = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < bars; i++) {
    const bw = 20 + Math.random() * 90;
    ctx.globalAlpha = 0.55 + Math.random() * 0.4;
    ctx.fillRect(20, 24 + i * 22, bw, 8);
  }
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

export function initProject() {
  const track = document.getElementById("project-track");
  const canvas = document.getElementById("project-canvas");
  if (!track || !canvas) return;
  const captions = [...track.querySelectorAll(".caption")];

  const rig = new GLRig(canvas, { bloom: true, bloomStrength: 0.72, bloomRadius: 0.55, bloomThreshold: 0.3, bg: "#050505" });
  rig.scene.fog = new THREE.FogExp2(0x0a0612, 0.05);

  const PURPLE = new THREE.Color("#ac7de6");
  const MAGENTA = new THREE.Color("#ef669c");

  // ── the arch tunnel ──
  const SPACING = 4.2;
  const COUNT = 14;
  const arches = [];
  const archGeo = new THREE.TorusGeometry(2.3, 0.06, 8, 48, Math.PI);
  for (let i = 0; i < COUNT; i++) {
    const tone = PURPLE.clone().lerp(MAGENTA, i / (COUNT - 1));
    const mat = new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: 0.55, fog: true });
    const arch = new THREE.Mesh(archGeo, mat);
    arch.position.set(0, -0.4, 3 - i * SPACING);
    arch.rotation.z = (Math.random() - 0.5) * 0.06;
    rig.scene.add(arch);
    arches.push(arch);
  }

  // ── floating hologram panels ──
  const panels = [];
  const palette = ["#70fbff", "#ac7de6", "#eba6fc", "#ef669c"];
  for (let i = 0; i < 10; i++) {
    const hex = palette[i % palette.length];
    const tex = holoTexture(hex);
    const w = 0.9 + Math.random() * 0.7;
    const geo = new THREE.PlaneGeometry(w, w * 0.62);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(geo, mat);
    const side = i % 2 === 0 ? -1 : 1;
    panel.position.set(side * (1.5 + Math.random() * 0.7), -0.3 + Math.random() * 1.3, 1 - i * (SPACING * COUNT / 10) - Math.random() * 2);
    panel.rotation.y = -side * (0.5 + Math.random() * 0.3);
    rig.scene.add(panel);
    panels.push(panel);
  }

  // ── drifting sparks ──
  const SPARKS = 260;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(SPARKS * 3);
  const sCol = new Float32Array(SPARKS * 3);
  const sBase = new Float32Array(SPARKS * 3);
  const tunnelLen = SPACING * COUNT;
  for (let i = 0; i < SPARKS; i++) {
    const z = 3 - Math.random() * tunnelLen;
    const a = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 2.1;
    sBase[i * 3] = Math.cos(a) * r;
    sBase[i * 3 + 1] = Math.sin(a) * r * 0.6 - 0.2;
    sBase[i * 3 + 2] = z;
    const c = PURPLE.clone().lerp(MAGENTA, Math.random());
    sCol[i * 3] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
  }
  sPos.set(sBase);
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
  const sMat = new THREE.PointsMaterial({ size: 0.06, map: dotAlphaTexture(), transparent: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const sparks = new THREE.Points(sGeo, sMat);
  rig.scene.add(sparks);

  // ── the forge glow waiting at the end of the tunnel ──
  const core = makeGlowSprite("#ef669c", 3.2, 0.16);
  core.position.set(0, -0.1, 3 - tunnelLen - 4);
  rig.scene.add(core);

  const stop = driveTrack(track, ({ t, progress, pointer }) => {
    const camZ = 6 - progress * (tunnelLen + 8);
    rig.camera.position.set(
      Math.sin(progress * Math.PI * 1.3) * 1.3 + pointer.x * 0.5,
      1.0 + Math.sin(progress * Math.PI * 0.8) * 0.35 - pointer.y * 0.25,
      camZ
    );
    rig.camera.lookAt(rig.camera.position.x * 0.25, rig.camera.position.y - 0.05, camZ - 8);

    for (const arch of arches) {
      const dist = Math.abs(camZ - arch.position.z);
      const pulse = 1 - Math.min(1, dist / 7);
      arch.material.opacity = 0.35 + pulse * 0.55;
      arch.scale.setScalar(1 + pulse * 0.06);
      arch.rotation.z += Math.sin(t * 0.2 + arch.position.z) * 0.0003;
    }

    const posAttr = sparks.geometry.attributes.position;
    for (let i = 0; i < SPARKS; i++) {
      posAttr.array[i * 3] = sBase[i * 3] + Math.sin(t * 0.6 + i) * 0.08;
      posAttr.array[i * 3 + 1] = sBase[i * 3 + 1] + Math.cos(t * 0.5 + i * 1.3) * 0.08;
    }
    posAttr.needsUpdate = true;

    core.material.opacity = 0.06 + band(progress, 0.55, 1) * 0.4 + Math.sin(t * 0.7) * 0.03;

    updateCaptions(captions, progress);
    rig.render();
  });

  return stop;
}
