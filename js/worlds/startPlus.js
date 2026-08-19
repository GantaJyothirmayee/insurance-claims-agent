import * as THREE from "three";
import { GLRig } from "../engine/glRig.js";
import { driveTrack } from "../engine/scrollDriver.js";

/** START+ — a small idea growing into a complete brand world. */
export function initStartPlus() {
  const track = document.getElementById("start-track");
  const canvas = document.getElementById("start-canvas");
  if (!track || !canvas) return;

  const rig = new GLRig(canvas, { bloom: true, bloomStrength: 0.5, bloomRadius: 0.55, bloomThreshold: 0.28 });
  rig.camera.position.set(0, 0, 8);
  rig.scene.position.x = -1.6; // keep the growth cluster clear of the right-aligned copy

  const lilac = new THREE.Color("#eba6fc");
  const purple = new THREE.Color("#ac7de6");

  // the seed
  const seedGeo = new THREE.IcosahedronGeometry(1, 1);
  const seedMat = new THREE.MeshBasicMaterial({ color: lilac.clone(), transparent: true, opacity: 0.55 });
  const seed = new THREE.Mesh(seedGeo, seedMat);
  rig.scene.add(seed);
  const seedWire = new THREE.Mesh(seedGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.18 }));
  seed.add(seedWire);

  // satellites that appear and drift outward as the idea grows — one InstancedMesh batch per palette color
  const PALETTE = ["#70fbff", "#ac7de6", "#eba6fc"];
  const PER_COLOR = 9; // 27 satellites total
  const satGeo = new THREE.OctahedronGeometry(1, 0);
  const batches = PALETTE.map((hex) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.95 });
    const mesh = new THREE.InstancedMesh(satGeo, mat, PER_COLOR);
    rig.scene.add(mesh);
    return mesh;
  });

  const items = [];
  let n = 0;
  const TOTAL = PALETTE.length * PER_COLOR;
  for (let c = 0; c < PALETTE.length; c++) {
    for (let k = 0; k < PER_COLOR; k++) {
      items.push({
        batch: c, local: k,
        dir: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(),
        reveal: 0.06 + (n / TOTAL) * 0.85,
        spinSpeed: 0.4 + Math.random() * 0.8,
        size: 0.09 + Math.random() * 0.16,
        far: 1.6 + Math.random() * 3.2,
      });
      n++;
    }
  }

  const dummy = new THREE.Object3D();
  const stop = driveTrack(track, ({ t, progress, pointer }) => {
    const seedScale = 0.35 + progress * 1.35;
    seed.scale.setScalar(seedScale);
    seed.rotation.y = t * 0.12 + pointer.x * 0.2;
    seed.rotation.x = t * 0.07 + pointer.y * 0.15;
    seedMat.color.copy(lilac).lerp(purple, Math.min(1, progress * 1.3));

    for (const it of items) {
      const grown = THREE.MathUtils.smoothstep(progress, it.reveal, it.reveal + 0.22);
      const dist = it.far * (0.15 + progress * 1.05);
      const p = it.dir.clone().multiplyScalar(dist);
      const wob = t * it.spinSpeed;
      dummy.position.copy(p).addScaledVector(new THREE.Vector3(Math.sin(wob), Math.cos(wob * 0.8), Math.sin(wob * 0.6)), 0.25);
      dummy.rotation.set(wob, wob * 0.7, 0);
      dummy.scale.setScalar((it.size * grown) || 0.0001);
      dummy.updateMatrix();
      batches[it.batch].setMatrixAt(it.local, dummy.matrix);
    }
    batches.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    rig.scene.rotation.y = progress * 0.4 + pointer.x * 0.1;

    rig.camera.position.z = 8.2 - progress * 1.6;
    rig.camera.position.x = pointer.x * 0.35;
    rig.camera.lookAt(0, 0, 0);

    rig.render();
  });

  return stop;
}
