import * as THREE from "three";

/**
 * Small shared toolkit for the procedural WebGL worlds (hero, process,
 * project, cta). Everything here builds real geometry/materials — no
 * pre-rendered imagery — so scenes are cheap, resolution-independent,
 * and answer to the same scroll-driven camera rig as the other worlds.
 */

/** Deterministic pseudo-random in [0,1) from an integer seed — stable
 * geometry across resizes without needing a real noise library. */
export function hash(i) {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Layered-sine "noise" — cheap stand-in for simplex noise, plenty
 * organic enough for silhouette jaggedness at this scale. */
export function ridgeNoise(x, seed = 0) {
  return (
    Math.sin(x * 0.9 + seed * 11.1) * 0.5 +
    Math.sin(x * 2.3 + seed * 3.7) * 0.28 +
    Math.sin(x * 5.1 + seed * 7.2) * 0.14
  );
}

/**
 * A jagged silhouette plane — flat bottom (buried below the visible
 * frame), noisy top edge — for layered fog-mountain backdrops.
 */
export function makeRidge({ width = 60, height = 14, segments = 28, seed = 0, jag = 1, baseY = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(width, height * 2, segments, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (y > 0) {
      const n = ridgeNoise((x / width) * segments, seed);
      pos.setY(i, height * 0.5 + n * height * 0.5 * jag);
    } else {
      pos.setY(i, -height * 1.4);
    }
  }
  geo.translate(0, baseY, 0);
  geo.computeVertexNormals();
  return geo;
}

let _glowTexCache = new Map();
function glowTexture(hex) {
  if (_glowTexCache.has(hex)) return _glowTexCache.get(hex);
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.35, hex + "cc");
  g.addColorStop(1, hex + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  _glowTexCache.set(hex, tex);
  return tex;
}

/** A soft additive glow billboard — horizon light, portal core, embers. */
export function makeGlowSprite(hexColor, size = 6, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(hexColor),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

/** A dome silhouette (upper hemisphere) with a thin emissive rim ring
 * at its base — reads as distant architecture without any texture work. */
export function makeDome(radius, fillHex, rimHex) {
  const group = new THREE.Group();
  const domeGeo = new THREE.SphereGeometry(radius, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.MeshBasicMaterial({ color: fillHex, fog: true });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  group.add(dome);
  const rimGeo = new THREE.TorusGeometry(radius * 0.995, radius * 0.012, 8, 48);
  const rimMat = new THREE.MeshBasicMaterial({ color: rimHex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  return group;
}

/** Smoothstep-clamped 0..1 helper, used everywhere for zone blending. */
export function band(p, a, b) {
  return Math.min(1, Math.max(0, (p - a) / Math.max(1e-6, b - a)));
}

let _dotTex = null;
/** Neutral soft-white falloff sprite for vertexColor'd point clouds
 * (sparks, motes) — tint comes from the material's vertex colors. */
export function dotAlphaTexture() {
  if (_dotTex) return _dotTex;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  _dotTex = new THREE.CanvasTexture(c);
  return _dotTex;
}

/**
 * A flat, unlit "water" plane with a baked-in pale streak down its
 * center (reads as a soft sky reflection under bloom). Ripple it per
 * frame with rippleFloor() — cheap since it's a plain MeshBasicMaterial,
 * no normals to recompute.
 */
export function makeReflectiveFloor({ width = 50, depth = 90, segW = 46, segD = 70, darkHex = "#060a10", streakHex = "#8fb0c9", streakWidth = 6 } = {}) {
  const geo = new THREE.PlaneGeometry(width, depth, segW, segD);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(darkHex);
  const streak = new THREE.Color(streakHex);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = Math.exp(-((x / streakWidth) ** 2));
    const c = dark.clone().lerp(streak, t * 0.35);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

/** Per-frame gentle ripple for makeReflectiveFloor() meshes. */
export function rippleFloor(mesh, t, amp = 0.03) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, Math.sin(x * 0.5 + t * 0.6) * amp + Math.sin(z * 0.35 - t * 0.4) * amp * 0.8);
  }
  pos.needsUpdate = true;
}

/** Sequentially lerps a color through a palette across [0,1] progress,
 * each transition softened by `w` — the "energy building" look used
 * across the SOLI worlds (gold→cyan→purple→magenta, etc). */
export function paletteBlend(p, colors, w = 0.18) {
  const out = colors[0].clone();
  const n = colors.length - 1;
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    out.lerp(colors[i + 1], band(p, a, a + w));
  }
  return out;
}
