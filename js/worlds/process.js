import * as THREE from "three";
import { GLRig } from "../engine/glRig.js";
import { driveTrack } from "../engine/scrollDriver.js";
import { updateCaptions } from "../engine/captions.js";
import { dotAlphaTexture, paletteBlend } from "../engine/sceneKit.js";

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function initProcess() {
  const track = document.getElementById("process-track");
  const canvas = document.getElementById("process-canvas");
  if (!track || !canvas) return;
  const captions = [...track.querySelectorAll(".caption")];

  const rig = new GLRig(canvas, { bloom: true, bloomStrength: 0.8, bloomRadius: 0.55, bloomThreshold: 0.2, bg: "#050505" });
  rig.scene.fog = new THREE.FogExp2(0x050505, 0.05);

  const PALETTE = [new THREE.Color("#70fbff"), new THREE.Color("#ac7de6"), new THREE.Color("#eba6fc"), new THREE.Color("#ef669c")];

  // ── the single road of the creative process — one path, four moods ──
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 11),
    new THREE.Vector3(-2.6, 0.6, 3.5),
    new THREE.Vector3(2.5, -0.35, -5),
    new THREE.Vector3(-1.9, 0.75, -13),
    new THREE.Vector3(1.6, 0.2, -22),
  ]);

  const RADIAL = 10;
  const TUBULAR = 260;
  const tubeGeo = new THREE.TubeGeometry(curve, TUBULAR, 0.05, RADIAL, false);
  const colors = new Float32Array(tubeGeo.attributes.position.count * 3);
  for (let seg = 0; seg <= TUBULAR; seg++) {
    const t = seg / TUBULAR;
    const c = paletteBlend(t, PALETTE, 0.22);
    for (let r = 0; r <= RADIAL; r++) {
      const idx = seg * (RADIAL + 1) + r;
      colors[idx * 3] = c.r; colors[idx * 3 + 1] = c.g; colors[idx * 3 + 2] = c.b;
    }
  }
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  tubeGeo.setAttribute("color", colorAttr);
  const tubeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  rig.scene.add(tube);

  const glowGeo = new THREE.TubeGeometry(curve, TUBULAR, 0.13, RADIAL, false);
  glowGeo.setAttribute("color", colorAttr);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  rig.scene.add(new THREE.Mesh(glowGeo, glowMat));

  // ── waypoint gates at each stage boundary — the four captions latch to these ──
  const boundaries = [0.02, 0.25, 0.5, 0.75];
  const gates = boundaries.map((bt) => {
    const p = curve.getPointAt(bt);
    const tangent = curve.getTangentAt(bt);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.02, 8, 40),
      new THREE.MeshBasicMaterial({ color: paletteBlend(bt + 0.05, PALETTE, 0.22), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.copy(p);
    ring.lookAt(p.clone().add(tangent));
    rig.scene.add(ring);
    return ring;
  });

  // ── drifting motes tracing the road ──
  const MOTES = 300;
  const mGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(MOTES * 3);
  const mCol = new Float32Array(MOTES * 3);
  const mSeed = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    const tpos = i / MOTES;
    const base = curve.getPointAt(tpos);
    const spread = 0.5;
    mPos[i * 3] = base.x + (Math.random() * 2 - 1) * spread;
    mPos[i * 3 + 1] = base.y + (Math.random() * 2 - 1) * spread * 0.7;
    mPos[i * 3 + 2] = base.z + (Math.random() * 2 - 1) * spread;
    const c = paletteBlend(tpos, PALETTE, 0.22);
    mCol[i * 3] = c.r; mCol[i * 3 + 1] = c.g; mCol[i * 3 + 2] = c.b;
    mSeed[i] = Math.random() * Math.PI * 2;
  }
  const mBase = mPos.slice();
  mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
  mGeo.setAttribute("color", new THREE.BufferAttribute(mCol, 3));
  const mMat = new THREE.PointsMaterial({ size: 0.05, map: dotAlphaTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const motes = new THREE.Points(mGeo, mMat);
  rig.scene.add(motes);

  const darkFog = new THREE.Color(0x050505);
  const stop = driveTrack(track, ({ t, progress, pointer }) => {
    const cp = Math.min(0.998, Math.max(0.002, progress));
    const pos = curve.getPointAt(cp);
    const lookP = curve.getPointAt(Math.min(1, cp + 0.05));
    const tangent = curve.getTangentAt(cp).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, WORLD_UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();

    rig.camera.position.copy(pos)
      .addScaledVector(right, pointer.x * 0.35)
      .addScaledVector(up, -pointer.y * 0.2);
    rig.camera.lookAt(lookP.clone().addScaledVector(right, pointer.x * 0.35));

    rig.scene.fog.color.copy(darkFog).lerp(paletteBlend(progress, PALETTE, 0.22), 0.16);

    const posAttr = mGeo.attributes.position;
    for (let i = 0; i < MOTES; i++) {
      posAttr.array[i * 3 + 1] = mBase[i * 3 + 1] + Math.sin(t * 0.5 + mSeed[i]) * 0.12;
      posAttr.array[i * 3] = mBase[i * 3] + Math.cos(t * 0.4 + mSeed[i] * 1.7) * 0.1;
    }
    posAttr.needsUpdate = true;

    gates.forEach((ring, i) => {
      const dist = Math.abs(progress - boundaries[i]);
      const pulse = 1 - Math.min(1, dist / 0.08);
      ring.scale.setScalar(1 + pulse * 0.4);
      ring.material.opacity = 0.35 + pulse * 0.55;
    });

    updateCaptions(captions, progress);
    rig.render();
  });

  return stop;
}
