import * as THREE from "three";
import { GLRig } from "../engine/glRig.js";
import { driveTrack } from "../engine/scrollDriver.js";

/** PASS SOLI+ — an unlimited creative universe: rings that multiply and orbit forever. */
export function initPassSoli() {
  const track = document.getElementById("pass-track");
  const canvas = document.getElementById("pass-canvas");
  if (!track || !canvas) return;

  const rig = new GLRig(canvas, { bloom: true, bloomStrength: 0.45, bloomRadius: 0.5, bloomThreshold: 0.3 });
  rig.camera.position.set(0, 0, 9);
  rig.scene.position.x = 1.6; // keep the ring cluster clear of the left-aligned copy

  const PALETTE = ["#70fbff", "#ac7de6", "#eba6fc", "#ef669c"];
  const PER_COLOR = 18; // COUNT = PALETTE.length * PER_COLOR
  const torusGeo = new THREE.TorusGeometry(1, 0.045, 12, 64);

  const batches = PALETTE.map((hex) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.8 });
    const mesh = new THREE.InstancedMesh(torusGeo, mat, PER_COLOR);
    rig.scene.add(mesh);
    return mesh;
  });

  const items = [];
  let n = 0;
  for (let c = 0; c < PALETTE.length; c++) {
    for (let k = 0; k < PER_COLOR; k++) {
      items.push({
        batch: c, local: k,
        radius: 1.4 + Math.random() * 3.6,
        speed: (0.12 + Math.random() * 0.22) * (Math.random() < 0.5 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
        tiltX: Math.random() * Math.PI,
        tiltZ: Math.random() * Math.PI,
        scale: 0.35 + Math.random() * 0.85,
        reveal: n / (PALETTE.length * PER_COLOR),
        wobble: Math.random() * Math.PI * 2,
      });
      n++;
    }
  }

  const dummy = new THREE.Object3D();
  const stop = driveTrack(track, ({ t, progress, pointer }) => {
    for (const it of items) {
      const angle = it.phase + t * it.speed;
      const grown = THREE.MathUtils.smoothstep(progress, it.reveal * 0.75, it.reveal * 0.75 + 0.18);
      const s = it.scale * grown;
      const r = it.radius;
      dummy.position.set(
        Math.cos(angle) * r,
        Math.sin(angle) * r * 0.55 + Math.sin(t * 0.3 + it.wobble) * 0.15,
        Math.sin(angle * 0.7) * r * 0.4
      );
      dummy.rotation.set(it.tiltX + angle * 0.2, angle, it.tiltZ);
      dummy.scale.setScalar(s || 0.0001);
      dummy.updateMatrix();
      batches[it.batch].setMatrixAt(it.local, dummy.matrix);
    }
    batches.forEach((m) => { m.instanceMatrix.needsUpdate = true; });

    rig.scene.rotation.y = progress * 0.6 + pointer.x * 0.15;
    rig.scene.rotation.x = pointer.y * 0.1;

    rig.camera.position.z = 9.5 - progress * 2.4;
    rig.camera.position.x = pointer.x * 0.4;
    rig.camera.lookAt(0, 0, 0);

    rig.render();
  });

  return stop;
}
