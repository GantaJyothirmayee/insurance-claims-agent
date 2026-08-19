import * as THREE from "three";
import { GLRig } from "../engine/glRig.js";
import { driveTrack } from "../engine/scrollDriver.js";
import { updateCaptions, bindScrollCue } from "../engine/captions.js";
import { ParticleField } from "../engine/particles.js";
import { updatePointer } from "../engine/pointer.js";
import { makeRidge, makeGlowSprite, makeReflectiveFloor, rippleFloor } from "../engine/sceneKit.js";

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** A small marble-and-stone pavilion cluster, echoing the valley retreat
 * from SOLI's mood boards — built from plain boxes, no texture work. */
function makePavilion(scene, x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.22, 1.7),
    new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.45, metalness: 0.04 })
  );
  slab.position.y = 0.11;
  group.add(slab);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 1.05, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.55, metalness: 0.08 })
  );
  wing.position.set(-0.2, 0.75, 0);
  group.add(wing);

  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.07, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xd9b87a, emissiveIntensity: 2.4 })
  );
  glow.position.set(-0.2, 0.55, 0.73);
  group.add(glow);

  scene.add(group);
  return group;
}

function makeGoldRock(scene, x, z, s = 1) {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.16 * s, 0),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xd9b87a, emissiveIntensity: 1.6, roughness: 0.3 })
  );
  rock.position.set(x, 0.16 * s, z);
  scene.add(rock);
  return rock;
}

export function initHero({ onProgress: reportGlobal, onLoadProgress, onReady } = {}) {
  const track = document.getElementById("hero-track");
  const canvas = document.getElementById("hero-canvas");
  if (!track || !canvas) return;
  const captions = [...track.querySelectorAll(".caption")];
  const cue = document.getElementById("scroll-cue");
  bindScrollCue(track, cue);

  const rig = new GLRig(canvas, { bloom: true, bloomStrength: 0.68, bloomRadius: 0.6, bloomThreshold: 0.3, bg: "#050505" });
  rig.scene.fog = new THREE.FogExp2(0x050505, 0.056);

  const hemi = new THREE.HemisphereLight(0xaebfd0, 0x0a0a0c, 0.95);
  rig.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xcfe0ee, 0.55);
  dir.position.set(-4, 6, 4);
  rig.scene.add(dir);

  // ── river / valley floor ──
  const river = makeReflectiveFloor({ width: 24, depth: 90, segW: 30, segD: 70, streakWidth: 3.2, streakHex: "#3f5568" });
  river.position.z = -18;
  rig.scene.add(river);

  // ── layered misty ridgelines ──
  const ridgeSeeds = [
    { z: -36, h: 9, seed: 1.4, color: 0x151a24 },
    { z: -50, h: 12, seed: 3.1, color: 0x0f131c },
    { z: -68, h: 15, seed: 5.6, color: 0x0a0d15 },
  ];
  for (const r of ridgeSeeds) {
    const geo = makeRidge({ width: 70, height: r.h, segments: 26, seed: r.seed, baseY: r.h * 0.15 });
    const mat = new THREE.MeshBasicMaterial({ color: r.color, fog: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = r.z;
    rig.scene.add(mesh);
  }

  // ── two pavilion clusters flanking the river ──
  makePavilion(rig.scene, -4.6, 2.6, 1);
  makePavilion(rig.scene, -5.4, -1.2, 0.85);
  makePavilion(rig.scene, 4.4, -7.6, 1);
  makePavilion(rig.scene, 5.3, -11.2, 0.9);

  const goldRocks = [];
  for (let i = 0; i < 9; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    goldRocks.push(makeGoldRock(rig.scene, side * (2.4 + Math.random() * 2), -Math.random() * 20 + 1, 0.7 + Math.random() * 0.8));
  }

  // ── the glow waiting at the far end of the valley ──
  const horizon = makeGlowSprite("#eba6fc", 7, 0.22);
  horizon.position.set(0.6, 3.2, -34);
  rig.scene.add(horizon);
  const horizonWarm = makeGlowSprite("#d9b87a", 4, 0.18);
  horizonWarm.position.set(0.6, 1.6, -32);
  rig.scene.add(horizonWarm);

  // ── camera dolly path through the valley ──
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.2, 13),
    new THREE.Vector3(-2.1, 1.7, 4),
    new THREE.Vector3(2.3, 1.35, -6.5),
    new THREE.Vector3(0.5, 1.05, -18),
    new THREE.Vector3(0.6, 1.0, -30),
  ]);

  const stop = driveTrack(track, ({ t, progress, pointer }) => {
    rig.scene.fog.density = 0.06 - progress * 0.024;

    const cp = Math.min(0.998, Math.max(0.002, progress));
    const pos = curve.getPointAt(cp);
    const lookP = curve.getPointAt(Math.min(1, cp + 0.06));
    const tangent = curve.getTangentAt(cp).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, WORLD_UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();

    rig.camera.position.copy(pos)
      .addScaledVector(right, pointer.x * 0.4)
      .addScaledVector(up, -pointer.y * 0.2);
    rig.camera.position.y += Math.sin(t * 0.25) * 0.04;
    rig.camera.lookAt(lookP.clone().addScaledVector(right, pointer.x * 0.4));

    rippleFloor(river, t);

    horizon.material.opacity = 0.08 + progress * 0.3 + Math.sin(t * 0.6) * 0.02;
    horizonWarm.material.opacity = 0.06 + progress * 0.2;
    for (const r of goldRocks) r.rotation.y = t * 0.3;

    updateCaptions(captions, progress);
    reportGlobal?.(progress);

    rig.render();
  });

  // ── atmospheric dust overlay (separate transparent canvas) ──
  const fx = document.getElementById("hero-fx");
  if (fx && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const field = new ParticleField(fx, { count: 160, colors: ["#70fbff", "#ac7de6", "#eba6fc"], spread: 0.9, size: 0.085, speed: 0.015, parallax: 0.5 });
    const clock = { t: 0, last: performance.now() };
    const loop = (now) => {
      const dt = (now - clock.last) / 1000; clock.last = now; clock.t += dt;
      const p = updatePointer();
      field.update(clock.t, p.x, p.y);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // no external assets to fetch — the scene is built from generated
  // geometry, so simulate a brief "materializing" ramp for a consistent
  // loading feel instead of snapping the bar straight to 100%.
  const start = performance.now();
  const DURATION = 420;
  const step = (now) => {
    const f = Math.min(1, (now - start) / DURATION);
    onLoadProgress?.(f);
    if (f < 1) requestAnimationFrame(step);
    else {
      onReady?.();
      const h1 = document.getElementById("hero-h1");
      if (h1 && window.gsap) {
        window.gsap.fromTo(h1, { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, ease: "power3.out", delay: 0.15 });
      }
    }
  };
  requestAnimationFrame(step);

  return stop;
}
