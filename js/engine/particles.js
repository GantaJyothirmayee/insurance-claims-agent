import * as THREE from "three";

/** Procedural soft-circle sprite so points read as glowing dust, not squares. */
function dotTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

let sharedTexture = null;

/**
 * A drifting field of glowing dust particles rendered on its own transparent
 * WebGL canvas, layered above a frame-scrub film or a WebGL world.
 */
export class ParticleField {
  constructor(canvas, { count = 220, colors = ["#70fbff", "#ac7de6", "#eba6fc"], spread = 1, size = 0.08, speed = 0.02, parallax = 0.4 } = {}) {
    this.canvas = canvas;
    this.parallax = parallax;
    this.speed = speed;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
    this.camera.position.z = 6;

    if (!sharedTexture) sharedTexture = dotTexture();

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const palette = colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * 8 * spread;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 5 * spread;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 6;
      const c = palette[i % palette.length];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      speeds[i] = 0.3 + Math.random() * 0.7;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.speeds = speeds;
    this.base = positions.slice();

    const mat = new THREE.PointsMaterial({
      size, sizeAttenuation: true, map: sharedTexture, transparent: true,
      opacity: 0.55, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.scene.add(this.points);

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas);
  }

  _resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** t: elapsed seconds, px/py: smoothed pointer in [-1,1] */
  update(t, px = 0, py = 0) {
    const pos = this.points.geometry.attributes.position;
    for (let i = 0; i < this.speeds.length; i++) {
      const s = this.speeds[i];
      pos.array[i * 3 + 1] = this.base[i * 3 + 1] + Math.sin(t * this.speed * 10 * s + i) * 0.6;
      pos.array[i * 3] = this.base[i * 3] + Math.cos(t * this.speed * 6 * s + i * 2) * 0.4;
    }
    pos.needsUpdate = true;
    this.camera.position.x = px * this.parallax;
    this.camera.position.y = -py * this.parallax;
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._ro?.disconnect();
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.renderer.dispose();
  }
}
