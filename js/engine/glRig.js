import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Shared WebGL rig: renderer + scene + camera + optional bloom composer,
 * with resize handling. One instance per pinned WebGL section.
 */
export class GLRig {
  constructor(canvas, { fov = 45, near = 0.1, far = 100, bloom = true, bloomStrength = 0.9, bloomRadius = 0.6, bloomThreshold = 0.15, bg = null } = {}) {
    this.canvas = canvas;
    const lowPower = window.matchMedia("(max-width: 760px)").matches;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: bg === null, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    if (bg) this.renderer.setClearColor(bg, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);

    this.useBloom = bloom && !lowPower;
    if (this.useBloom) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bloomStrength, bloomRadius, bloomThreshold);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas);
  }

  _resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  }

  render() {
    if (this.useBloom) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._ro?.disconnect();
    this.renderer.dispose();
  }
}
