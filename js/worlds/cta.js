import * as THREE from "three";
import { GLRig } from "../engine/glRig.js";
import { driveTrack } from "../engine/scrollDriver.js";
import { updateCaptions } from "../engine/captions.js";
import { ParticleField } from "../engine/particles.js";
import { updatePointer } from "../engine/pointer.js";
import { makeDome, makeGlowSprite, makeReflectiveFloor, rippleFloor, band } from "../engine/sceneKit.js";

/** Simple two-stop vertical gradient sky, cheap and texture-free. */
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color("#050505") },
      bottomColor: { value: new THREE.Color("#1b0f22") },
      offset: { value: 12 },
      exponent: { value: 0.75 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide,
    fog: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), mat);
}

export function initCta() {
  const track = document.getElementById("cta-track");
  const canvas = document.getElementById("cta-canvas");
  if (!track || !canvas) return;
  const captions = [...track.querySelectorAll(".caption")];

  const rig = new GLRig(canvas, { bloom: true, bloomStrength: 0.72, bloomRadius: 0.65, bloomThreshold: 0.3, bg: "#050505", far: 220 });
  rig.scene.fog = new THREE.FogExp2(0x0a0710, 0.028);

  const sky = makeSky();
  rig.scene.add(sky);

  const ocean = makeReflectiveFloor({ width: 120, depth: 120, segW: 40, segD: 40, darkHex: "#05050a", streakHex: "#5c4468", streakWidth: 5 });
  ocean.position.y = -2;
  rig.scene.add(ocean);

  // ── a distant skyline of domes, echoing the "city emerging from fog" shots ──
  const domeTones = [["#0b0d12", "#70fbff"], ["#0b0d12", "#ac7de6"], ["#0b0d12", "#eba6fc"], ["#0b0d12", "#ef669c"]];
  for (let i = 0; i < 8; i++) {
    const [fill, rim] = domeTones[i % domeTones.length];
    const radius = 1.1 + Math.random() * 2.3;
    const dome = makeDome(radius, fill, rim);
    dome.position.set((Math.random() - 0.5) * 34, -1.98, -14 - Math.random() * 26);
    rig.scene.add(dome);
  }

  // ── the gateway ──
  const CYAN = new THREE.Color("#70fbff"), PURPLE = new THREE.Color("#ac7de6"), MAGENTA = new THREE.Color("#ef669c");
  const ringGeo = new THREE.TorusGeometry(2.4, 0.09, 14, 72);
  const rp = ringGeo.attributes.position;
  const ringColors = new Float32Array(rp.count * 3);
  for (let i = 0; i < rp.count; i++) {
    const ang = (Math.atan2(rp.getY(i), rp.getX(i)) + Math.PI) / (Math.PI * 2);
    const c = ang < 0.5 ? CYAN.clone().lerp(PURPLE, ang * 2) : PURPLE.clone().lerp(MAGENTA, (ang - 0.5) * 2);
    ringColors[i * 3] = c.r; ringColors[i * 3 + 1] = c.g; ringColors[i * 3 + 2] = c.b;
  }
  ringGeo.setAttribute("color", new THREE.BufferAttribute(ringColors, 3));
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.set(0, 1.2, -6);
  rig.scene.add(ring);

  const core = makeGlowSprite("#f4f1ec", 2.0, 0.12);
  core.position.copy(ring.position);
  rig.scene.add(core);

  // ── camera sweeps in from a wide overlook down into the gateway ──
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 6.4, 27),
    new THREE.Vector3(5.5, 3.0, 9),
    new THREE.Vector3(0, 1.25, -3.5)
  );

  const stop = driveTrack(track, ({ t, progress, pointer }) => {
    rig.scene.fog.density = 0.034 - progress * 0.014;
    sky.material.uniforms.bottomColor.value.set("#1b0f22").lerp(PURPLE.clone().multiplyScalar(0.5), progress * 0.5);

    const cp = Math.min(1, Math.max(0, progress));
    const pos = curve.getPointAt(cp);
    rig.camera.position.set(pos.x + pointer.x * 0.5, pos.y - pointer.y * 0.25, pos.z);

    const lookTarget = ring.position.clone().lerp(new THREE.Vector3(0, 1.2, -16), band(progress, 0.78, 1));
    rig.camera.lookAt(lookTarget);

    rippleFloor(ocean, t, 0.02);

    ring.rotation.z = Math.sin(t * 0.15) * 0.03;
    const ringScale = 1 + Math.sin(t * 0.6) * 0.015 + progress * 0.05;
    ring.scale.setScalar(ringScale);
    core.material.opacity = 0.06 + progress * 0.3 + Math.sin(t * 0.6) * 0.02;
    core.scale.setScalar(2.0 + progress * 1.3);

    updateCaptions(captions, progress);
    rig.render();
  });

  const fx = document.getElementById("cta-fx");
  if (fx && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const field = new ParticleField(fx, { count: 90, colors: ["#eba6fc", "#ef669c", "#70fbff"], spread: 0.7, size: 0.065, speed: 0.01, parallax: 0.3 });
    const clock = { t: 0, last: performance.now() };
    const loop = (now) => {
      const dt = (now - clock.last) / 1000; clock.last = now; clock.t += dt;
      const p = updatePointer();
      field.update(clock.t, p.x, p.y);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  return stop;
}
