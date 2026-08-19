import * as THREE from "three";
import { GLRig } from "../engine/glRig.js";
import { driveTrack } from "../engine/scrollDriver.js";

const PARTICLE_VERT = `
  attribute float reveal;
  attribute vec3 pcolor;
  uniform float uProgress;
  uniform float uSize;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vColor = pcolor;
    float d = uProgress - reveal;
    vAlpha = smoothstep(0.0, 0.12, d) * (1.0 - smoothstep(0.35, 0.75, d));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const PARTICLE_FRAG = `
  precision mediump float;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, glow * vAlpha);
  }
`;

export function initWhoWeAre() {
  const track = document.getElementById("who-track");
  const canvas = document.getElementById("who-canvas");
  const copy = document.getElementById("who-copy");
  if (!track || !canvas) return;

  const rig = new GLRig(canvas, { bloom: true, bloomStrength: 0.7, bloomRadius: 0.6, bloomThreshold: 0.22 });
  rig.camera.position.set(0, 0, 6.2);

  // ── the seam: a wavy tube echoing the gold vein from the valley footage ──
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.6, 1.7, 0),
    new THREE.Vector3(-1.6, 0.6, 0.4),
    new THREE.Vector3(-0.4, 1.0, -0.3),
    new THREE.Vector3(0.6, -0.4, 0.3),
    new THREE.Vector3(1.8, 0.2, -0.2),
    new THREE.Vector3(2.7, -1.3, 0.4),
  ]);
  const tubeGeo = new THREE.TubeGeometry(curve, 220, 0.045, 10, false);
  const gold = new THREE.Color("#d9b87a");
  const cyan = new THREE.Color("#70fbff");
  const purple = new THREE.Color("#ac7de6");
  const magenta = new THREE.Color("#ef669c");

  const tubeMat = new THREE.MeshBasicMaterial({ color: gold.clone(), transparent: true, opacity: 0.95 });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  rig.scene.add(tube);

  // soft outer glow shell
  const glowGeo = new THREE.TubeGeometry(curve, 220, 0.11, 10, false);
  const glowMat = new THREE.MeshBasicMaterial({ color: gold.clone(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowTube = new THREE.Mesh(glowGeo, glowMat);
  rig.scene.add(glowTube);

  // ── particles fracturing off the seam as the visitor scrolls ──
  const COUNT = 420;
  const positions = new Float32Array(COUNT * 3);
  const reveal = new Float32Array(COUNT);
  const pcolor = new Float32Array(COUNT * 3);
  const palette = [cyan, purple, magenta];
  for (let i = 0; i < COUNT; i++) {
    const tpos = i / COUNT;
    const base = curve.getPointAt(tpos);
    const spread = 0.15 + tpos * 1.6;
    positions[i * 3] = base.x + (Math.random() * 2 - 1) * spread;
    positions[i * 3 + 1] = base.y + (Math.random() * 2 - 1) * spread * 0.8;
    positions[i * 3 + 2] = base.z + (Math.random() * 2 - 1) * spread;
    reveal[i] = tpos * 0.85 + Math.random() * 0.15;
    const c = palette[i % palette.length];
    pcolor[i * 3] = c.r; pcolor[i * 3 + 1] = c.g; pcolor[i * 3 + 2] = c.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute("reveal", new THREE.BufferAttribute(reveal, 1));
  pGeo.setAttribute("pcolor", new THREE.BufferAttribute(pcolor, 3));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uSize: { value: 0.55 } },
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  rig.scene.add(points);

  const stop = driveTrack(track, ({ t, progress, pointer }) => {
    // color: gold at rest, blooming into SOLI energy as the section plays
    const mixT = Math.min(1, progress * 1.4);
    const c1 = gold.clone().lerp(cyan, Math.min(1, mixT * 1.6));
    const c2 = c1.clone().lerp(purple, Math.max(0, mixT - 0.35) * 1.5);
    const c3 = c2.clone().lerp(magenta, Math.max(0, mixT - 0.7) * 2.2);
    tubeMat.color.copy(c3);
    glowMat.color.copy(c3);
    glowMat.opacity = 0.14 + mixT * 0.12;

    pMat.uniforms.uProgress.value = progress;

    tube.rotation.y = progress * 0.5 + pointer.x * 0.12;
    tube.rotation.x = pointer.y * 0.08;
    glowTube.rotation.copy(tube.rotation);
    points.rotation.copy(tube.rotation);

    rig.camera.position.x = Math.sin(t * 0.05) * 0.3 + pointer.x * 0.25;
    rig.camera.position.y = Math.cos(t * 0.04) * 0.15 - pointer.y * 0.15;
    rig.camera.position.z = 6.4 - progress * 1.1;
    rig.camera.lookAt(0, 0, 0);

    if (copy) copy.style.opacity = String(Math.min(1, progress * 3) * (1 - Math.max(0, progress - 0.8) * 5));

    rig.render();
  });

  return stop;
}
