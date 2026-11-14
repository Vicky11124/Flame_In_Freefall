import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BurnResult, Material } from "@/lib/burn";

/* Units: centimetres, seconds. Sample: x in [-10, 10], y in [-2.5, 2.5], z = 0. Flow is +x. */

export type Phase = "idle" | "igniting" | "burning" | "dying" | "extinguished" | "burnout";

export interface Params {
  material: Material;
  result: BurnResult;
  flow: number;
  direction: "concurrent" | "opposed";
  gravity: number;
  o2: number;
}

export interface Telemetry {
  phase: Phase;
  t: number;
  burned: number; // cm
  rate: number; // mm/s
  strength: number;
}

const L = 20; // sample length
const H = 5; // sample height
const TEX_W = 1024;
const TEX_H = 256;
const N_FLAME = 2600;
const N_SMOKE = 700;
const N_TRACE = 240;

const FLAME_VERT = `
attribute float aAge;
attribute float aSize;
attribute float aHeat;
varying float vAge;
varying float vHeat;
uniform float uScale;
void main(){
  vAge = aAge; vHeat = aHeat;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FLAME_FRAG = `
varying float vAge;
varying float vHeat;
uniform float uSoot;
uniform float uO2;
void main(){
  if (vAge >= 1.0) discard;
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float soft = smoothstep(1.0, 0.0, d);
  vec3 blue = vec3(0.22, 0.42, 1.0);
  vec3 white = vec3(1.0, 0.93, 0.8);
  vec3 yellow = vec3(1.0, 0.68, 0.22);
  vec3 red = vec3(0.9, 0.22, 0.05);
  vec3 lum = mix(white, mix(yellow, red, smoothstep(0.3, 1.0, vAge)), smoothstep(0.0, 0.18, vAge));
  float sootMix = clamp(uSoot * 1.7, 0.0, 1.0) * smoothstep(0.04, 0.3, vAge) * (0.6 + 0.4 * vHeat);
  vec3 col = mix(blue * (1.0 + 0.5 * uO2), lum, sootMix);
  float a = soft * pow(1.0 - vAge, 1.4) * mix(0.9, 0.55, sootMix);
  gl_FragColor = vec4(col * a, a);
}`;
const SMOKE_FRAG = `
varying float vAge;
varying float vHeat;
void main(){
  if (vAge >= 1.0) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.2, d) * (1.0 - vAge) * smoothstep(0.0, 0.15, vAge) * 0.16;
  gl_FragColor = vec4(vec3(0.42, 0.40, 0.38), a);
}`;

interface Pool {
  pos: Float32Array;
  vel: Float32Array;
  age: Float32Array;
  life: Float32Array;
  size: Float32Array;
  heat: Float32Array;
  head: number;
  geo: THREE.BufferGeometry;
}

function makePool(n: number): Pool {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const age = new Float32Array(n).fill(1);
  const size = new Float32Array(n);
  const heat = new Float32Array(n);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aAge", new THREE.BufferAttribute(age, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aHeat", new THREE.BufferAttribute(heat, 1));
  return { pos, vel: new Float32Array(n * 3), age, life: new Float32Array(n).fill(1), size, heat, head: 0, geo };
}

export class TunnelEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raf = 0;
  private last = performance.now();
  private ro: ResizeObserver;

  private p: Params | null = null;
  private speed = 5;
  private phase: Phase = "idle";
  private simT = 0;
  private phaseT = 0;
  private burned = 0;
  private rate = 0;
  private strength = 0;
  private ember = 0;

  private flame = makePool(N_FLAME);
  private smoke = makePool(N_SMOKE);
  private flameMat: THREE.ShaderMaterial;
  private trace: THREE.LineSegments;
  private tracePos = new Float32Array(N_TRACE * 6);
  private traceSeed = new Float32Array(N_TRACE * 3);
  private fan = new THREE.Group();
  private igniter: THREE.Mesh;
  private light: THREE.PointLight;

  private colorCanvas = document.createElement("canvas");
  private emitCanvas = document.createElement("canvas");
  private baseCanvas = document.createElement("canvas");
  private charCanvas = document.createElement("canvas");
  private colorTex: THREE.CanvasTexture;
  private emitTex: THREE.CanvasTexture;
  private sampleMat: THREE.MeshStandardMaterial;
  private materialId = "";

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x0b0a09);
    this.scene.fog = new THREE.Fog(0x0b0a09, 70, 140);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
    this.camera.position.set(16, 9, 40);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 14;
    this.controls.maxDistance = 85;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.target.set(0, 0.5, 0);

    // lights
    this.scene.add(new THREE.AmbientLight(0x8890a8, 0.55));
    const key = new THREE.DirectionalLight(0xfff1de, 1.1);
    key.position.set(10, 25, 20);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6aa8ff, 0.5);
    rim.position.set(-20, 6, -18);
    this.scene.add(rim);
    this.light = new THREE.PointLight(0xff8a3c, 0, 40, 1.6);
    this.scene.add(this.light);

    this.buildTunnel();

    // sample
    for (const [c, w, h] of [
      [this.colorCanvas, TEX_W, TEX_H],
      [this.emitCanvas, TEX_W, TEX_H],
      [this.baseCanvas, TEX_W, TEX_H],
      [this.charCanvas, TEX_W, TEX_H],
    ] as const) {
      c.width = w;
      c.height = h;
    }
    this.colorTex = new THREE.CanvasTexture(this.colorCanvas);
    this.colorTex.colorSpace = THREE.SRGBColorSpace;
    this.colorTex.anisotropy = 4;
    this.emitTex = new THREE.CanvasTexture(this.emitCanvas);
    this.sampleMat = new THREE.MeshStandardMaterial({
      map: this.colorTex,
      emissiveMap: this.emitTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.2,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.02,
    });
    const sample = new THREE.Mesh(new THREE.PlaneGeometry(L, H), this.sampleMat);
    this.scene.add(sample);

    // sample holder frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.7, roughness: 0.35 });
    for (const y of [H / 2 + 0.25, -H / 2 - 0.25]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(L + 1.4, 0.5, 0.5), frameMat);
      bar.position.y = y;
      this.scene.add(bar);
    }
    for (const x of [-L / 2 - 0.45, L / 2 + 0.45]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, H + 1, 0.5), frameMat);
      post.position.x = x;
      this.scene.add(post);
    }
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x2a2724, metalness: 0.6, roughness: 0.4 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4, 12), rodMat);
    rod.position.set(0, -H / 2 - 2.4, 0);
    this.scene.add(rod);

    // igniter wire
    this.igniter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, H, 8),
      new THREE.MeshStandardMaterial({ color: 0x555049, emissive: new THREE.Color(0xff5a1a), emissiveIntensity: 0 })
    );
    this.igniter.position.z = 0.25;
    this.scene.add(this.igniter);

    // particles
    this.flameMat = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      uniforms: { uScale: { value: 300 }, uSoot: { value: 0.5 }, uO2: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const flamePts = new THREE.Points(this.flame.geo, this.flameMat);
    flamePts.frustumCulled = false;
    this.scene.add(flamePts);
    const smokeMat = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT,
      fragmentShader: SMOKE_FRAG,
      uniforms: { uScale: { value: 300 } },
      transparent: true,
      depthWrite: false,
    });
    const smokePts = new THREE.Points(this.smoke.geo, smokeMat);
    smokePts.frustumCulled = false;
    this.scene.add(smokePts);

    // flow tracers
    const tgeo = new THREE.BufferGeometry();
    tgeo.setAttribute("position", new THREE.BufferAttribute(this.tracePos, 3));
    this.trace = new THREE.LineSegments(
      tgeo,
      new THREE.LineBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0, depthWrite: false })
    );
    this.trace.frustumCulled = false;
    for (let i = 0; i < N_TRACE; i++) {
      this.traceSeed[i * 3] = Math.random() * 44 - 22;
      this.traceSeed[i * 3 + 1] = Math.random() * 12 - 6;
      this.traceSeed[i * 3 + 2] = Math.random() * 12 - 6;
    }
    this.scene.add(this.trace);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.loop();
  }

  private buildTunnel() {
    const W = 44, S = 13;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(W, S, S),
      new THREE.MeshPhysicalMaterial({
        color: 0x9cc6ff, transparent: true, opacity: 0.045, roughness: 0.05, metalness: 0,
        side: THREE.BackSide, depthWrite: false,
      })
    );
    this.scene.add(glass);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(W, S, S)),
      new THREE.LineBasicMaterial({ color: 0x8a8378, transparent: true, opacity: 0.45 })
    );
    this.scene.add(edges);
    // ribs
    const ribMat = new THREE.LineBasicMaterial({ color: 0x8a8378, transparent: true, opacity: 0.18 });
    for (const x of [-16, 16]) {
      const r = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(S, S)), ribMat);
      r.rotation.y = Math.PI / 2;
      r.position.x = x;
      this.scene.add(r);
    }
    // fan shroud + blades at the inlet
    const metal = new THREE.MeshStandardMaterial({ color: 0x4a4540, metalness: 0.8, roughness: 0.3 });
    const shroud = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.35, 12, 48), metal);
    shroud.rotation.y = Math.PI / 2;
    shroud.position.x = -W / 2 - 0.4;
    this.scene.add(shroud);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.8, 20), metal);
    hub.rotation.z = Math.PI / 2;
    this.fan.add(hub);
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 4.6, 1.4), metal);
      blade.position.y = 2.6;
      const g = new THREE.Group();
      g.add(blade);
      g.rotation.x = (i / 5) * Math.PI * 2;
      blade.rotation.y = 0.5;
      this.fan.add(g);
    }
    this.fan.position.x = -W / 2 - 0.4;
    this.scene.add(this.fan);
    // outlet mesh screen
    const screen = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(S, S, 8, 8)),
      new THREE.LineBasicMaterial({ color: 0x8a8378, transparent: true, opacity: 0.3 })
    );
    screen.rotation.y = Math.PI / 2;
    screen.position.x = W / 2;
    this.scene.add(screen);
    // stands + floor grid
    for (const x of [-15, 15]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), metal);
      leg.position.set(x, -S / 2 - 3, 0);
      this.scene.add(leg);
    }
    const grid = new THREE.GridHelper(120, 60, 0x2a2622, 0x1a1816);
    grid.position.y = -S / 2 - 6;
    this.scene.add(grid);
  }

  /* ---------------- public API ---------------- */

  setParams(p: Params) {
    this.p = p;
    if (p.material.id !== this.materialId) {
      this.materialId = p.material.id;
      this.paintBase(p.material);
      this.reset();
    }
    this.flameMat.uniforms.uSoot.value = p.result.sootiness;
    this.flameMat.uniforms.uO2.value = Math.max(0, (p.o2 - 21) / 20);
  }

  setSpeed(s: number) {
    this.speed = s;
  }

  ignite() {
    if (this.phase === "burning" || this.phase === "igniting") return;
    if (this.phase === "burnout" || this.burned > 0) this.resetBurn();
    this.phase = "igniting";
    this.phaseT = 0;
  }

  reset() {
    this.resetBurn();
    this.phase = "idle";
  }

  telemetry(): Telemetry {
    return { phase: this.phase, t: this.simT, burned: this.burned, rate: this.rate, strength: this.strength };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }

  /* ---------------- internals ---------------- */

  private resetBurn() {
    this.simT = 0;
    this.phaseT = 0;
    this.burned = 0;
    this.rate = 0;
    this.strength = 0;
    this.ember = 0;
    this.flame.age.fill(1);
    this.smoke.age.fill(1);
    this.paintSample();
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.flameMat.uniforms.uScale.value = h * 0.9;
  }

  private frontX() {
    if (!this.p) return -L / 2;
    return this.p.direction === "concurrent" ? -L / 2 + this.burned : L / 2 - this.burned;
  }

  private paintBase(m: Material) {
    const c = this.baseCanvas.getContext("2d")!;
    c.clearRect(0, 0, TEX_W, TEX_H);
    c.fillStyle = m.color;
    c.globalAlpha = m.weave === "film" ? 0.55 : 1;
    c.fillRect(0, 0, TEX_W, TEX_H);
    c.globalAlpha = 1;
    if (m.weave === "fabric") {
      c.strokeStyle = "rgba(0,0,0,0.12)";
      c.lineWidth = 1;
      for (let x = 0; x < TEX_W; x += 4) {
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, TEX_H); c.stroke();
      }
      c.strokeStyle = "rgba(255,255,255,0.10)";
      for (let y = 0; y < TEX_H; y += 4) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(TEX_W, y); c.stroke();
      }
    } else if (m.weave === "film" || m.weave === "slab") {
      const g = c.createLinearGradient(0, 0, TEX_W, TEX_H);
      g.addColorStop(0, "rgba(255,255,255,0.25)");
      g.addColorStop(0.5, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,0.18)");
      c.fillStyle = g;
      c.fillRect(0, 0, TEX_W, TEX_H);
    } else {
      for (let i = 0; i < 1800; i++) {
        c.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
        c.fillRect(Math.random() * TEX_W, Math.random() * TEX_H, 2, 2);
      }
    }
    // char layer
    const k = this.charCanvas.getContext("2d")!;
    k.clearRect(0, 0, TEX_W, TEX_H);
    const hole = m.weave === "film" || m.weave === "paper";
    const charCol = m.weave === "rubber" ? [205, 200, 192] : m.weave === "slab" ? [40, 24, 14] : [24, 19, 16];
    if (!hole) {
      k.fillStyle = `rgb(${charCol.join(",")})`;
      k.fillRect(0, 0, TEX_W, TEX_H);
      for (let i = 0; i < 2600; i++) {
        const v = Math.random();
        k.fillStyle = m.id === "sibal" ? `rgba(200,195,185,${v * 0.35})` : `rgba(${v > 0.5 ? 90 : 0},${v > 0.5 ? 80 : 0},${v > 0.5 ? 70 : 0},${0.25 * v})`;
        k.fillRect(Math.random() * TEX_W, Math.random() * TEX_H, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
    }
    this.paintSample();
  }

  private paintSample() {
    const m = this.p?.material;
    const c = this.colorCanvas.getContext("2d")!;
    const e = this.emitCanvas.getContext("2d")!;
    c.clearRect(0, 0, TEX_W, TEX_H);
    c.drawImage(this.baseCanvas, 0, 0);
    e.fillStyle = "#000";
    e.fillRect(0, 0, TEX_W, TEX_H);
    if (this.burned > 0 && m) {
      const pxPerCm = TEX_W / L;
      const conc = this.p!.direction === "concurrent";
      const front = conc ? this.burned * pxPerCm : TEX_W - this.burned * pxPerCm;
      const x0 = conc ? 0 : front;
      const w = this.burned * pxPerCm;
      const hole = m.weave === "film" || m.weave === "paper";
      // ragged burn edge
      c.save();
      c.beginPath();
      c.moveTo(x0, 0);
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const y = (i / steps) * TEX_H;
        const jag = Math.sin(i * 1.7 + this.burned) * 6 + Math.sin(i * 4.1) * 4;
        c.lineTo(conc ? front + jag : front - jag, y);
      }
      c.lineTo(conc ? 0 : TEX_W, TEX_H);
      c.lineTo(conc ? 0 : TEX_W, 0);
      c.closePath();
      c.clip();
      if (hole) c.clearRect(x0 - 10, 0, w + 20, TEX_H);
      else c.drawImage(this.charCanvas, 0, 0);
      c.restore();
      // pyrolysis browning ahead of the front
      const pw = 1.4 * pxPerCm;
      const g = c.createLinearGradient(front, 0, conc ? front + pw : front - pw, 0);
      g.addColorStop(0, "rgba(70,38,16,0.85)");
      g.addColorStop(1, "rgba(70,38,16,0)");
      c.fillStyle = g;
      c.fillRect(conc ? front : front - pw, 0, pw, TEX_H);
      // glowing ember band
      if (this.ember > 0.01) {
        const ew = (hole ? 0.5 : 1.1) * pxPerCm;
        const eg = e.createLinearGradient(front - ew, 0, front + ew, 0);
        const a = Math.min(1, this.ember);
        eg.addColorStop(0, "rgba(0,0,0,0)");
        eg.addColorStop(0.5, `rgba(255,${120 + 80 * a},${40 * a},${a})`);
        eg.addColorStop(1, "rgba(0,0,0,0)");
        e.fillStyle = eg;
        e.fillRect(front - ew, 0, ew * 2, TEX_H);
        if (!hole) {
          for (let i = 0; i < 90 * a; i++) {
            const dx = Math.random() * 2.2 * pxPerCm * (conc ? -1 : 1);
            e.fillStyle = `rgba(255,${90 + Math.random() * 90},20,${Math.random() * a * 0.8})`;
            e.fillRect(front + dx, Math.random() * TEX_H, 2, 2);
          }
        }
      }
    }
    this.colorTex.needsUpdate = true;
    this.emitTex.needsUpdate = true;
  }

  private step(dtReal: number) {
    const p = this.p;
    if (!p) return;
    const dt = dtReal * this.speed;
    const r = p.result;
    const target = r.burns ? Math.max(0.3, Math.min(1.25, 0.4 + r.margin / 7)) : 0;

    switch (this.phase) {
      case "igniting": {
        this.simT += dt;
        this.phaseT += dt;
        // igniter makes a small flame regardless; the material decides whether it holds
        this.strength += (Math.max(0.35, target) - this.strength) * Math.min(1, dtReal * 3);
        if (this.phaseT > 3) this.phase = r.burns ? "burning" : "dying";
        break;
      }
      case "burning": {
        this.simT += dt;
        if (!r.burns) {
          this.phase = "dying";
          break;
        }
        const accel = p.direction === "concurrent" ? 1 + 0.6 * Math.min(this.burned, 10) / 10 * Math.min(1, p.gravity + 0.2) : 1;
        this.rate = r.spread * accel; // mm/s
        this.burned += (this.rate / 10) * dt;
        this.strength += (target - this.strength) * Math.min(1, dtReal * 2);
        if (this.burned >= L) {
          this.burned = L;
          this.phase = "burnout";
        }
        break;
      }
      case "dying": {
        this.simT += dt;
        this.rate = 0;
        this.strength *= Math.exp(-dtReal * 1.6);
        if (r.burns && this.strength > 0.08) this.phase = "burning";
        else if (this.strength < 0.02) {
          this.strength = 0;
          this.phase = "extinguished";
        }
        break;
      }
      case "burnout":
      case "extinguished":
        this.rate = 0;
        this.strength *= Math.exp(-dtReal * 2.5);
        break;
    }
    const igniting = this.phase === "igniting";
    this.ember += ((this.strength > 0.05 ? Math.min(1, this.strength + 0.2) : 0) - this.ember) * Math.min(1, dtReal * 2);
    if (this.strength > 0.001 || this.ember > 0.005 || igniting) this.paintSample();

    // igniter
    const ix = p.direction === "concurrent" ? -L / 2 + 0.3 : L / 2 - 0.3;
    this.igniter.position.x = ix;
    const im = this.igniter.material as THREE.MeshStandardMaterial;
    im.emissiveIntensity += ((igniting ? 3 : 0) - im.emissiveIntensity) * Math.min(1, dtReal * 4);

    // light follows the flame
    const fx = this.frontX();
    this.light.position.set(fx + (p.direction === "concurrent" ? 1.5 : 0.8), 1 + p.gravity * 2, 3);
    const lc = new THREE.Color(0x4f7dff).lerp(new THREE.Color(0xff8a3c), r.sootiness);
    this.light.color.copy(lc);
    this.light.intensity = this.strength * (6 + 16 * r.sootiness) * (0.85 + Math.random() * 0.3);

    this.updateFlame(dtReal, fx);
    this.updateSmoke(dtReal, fx);
    this.updateTrace(dtReal);
    this.fan.rotation.x += dtReal * p.flow * 0.6;
  }

  private emit(pool: Pool, n: number, init: (i: number) => void) {
    const cap = pool.age.length;
    for (let k = 0; k < n; k++) {
      const i = pool.head;
      pool.head = (pool.head + 1) % cap;
      init(i);
    }
  }

  private updateFlame(dt: number, fx: number) {
    const p = this.p!;
    const r = p.result;
    const f = this.flame;
    const g = p.gravity;
    const u = p.flow;
    const len = Math.max(0.6, r.flameLen) * (0.5 + 0.5 * this.strength);
    const count = Math.floor(this.strength * 2100 * dt + Math.random());
    const ug = g < 0.02;
    this.emit(f, count, (i) => {
      const side = Math.random() < 0.5 ? -1 : 1;
      f.pos[i * 3] = fx + (Math.random() - 0.5) * (ug ? 0.5 : 1.4);
      f.pos[i * 3 + 1] = (Math.random() - 0.5) * H * 0.98;
      f.pos[i * 3 + 2] = side * (0.08 + Math.random() * 0.15);
      const out = ug ? 0.8 + Math.random() * 1.2 : 0.6 + Math.random() * 0.8;
      // spread of the flame over the fuel: carried by the flow (downstream = +x)
      f.vel[i * 3] = u * (0.6 + Math.random() * 0.5) + (Math.random() - 0.5) * (ug ? 2.2 : 3.5);
      f.vel[i * 3 + 1] = ug ? (Math.random() - 0.5) * 1.6 : 2 + Math.random() * 3;
      f.vel[i * 3 + 2] = side * out;
      f.age[i] = 0;
      const speed = Math.max(2.5, Math.hypot(u, 30 * Math.cbrt(Math.max(g, 0))));
      f.life[i] = (0.25 + (len / speed) * (0.7 + Math.random() * 0.6)) * (ug && u < 2 ? 1.8 : 1);
      f.size[i] = (1.3 + Math.random() * 1.7) * (0.7 + 0.5 * this.strength) * (ug ? 1.25 : 1);
      f.heat[i] = Math.random();
    });
    const ay = 160 * g;
    for (let i = 0; i < f.age.length; i++) {
      if (f.age[i] >= 1) continue;
      f.age[i] += dt / f.life[i];
      f.vel[i * 3 + 1] += ay * dt;
      // gentle pull toward the flow speed, damp sideways motion
      f.vel[i * 3] += (u - f.vel[i * 3]) * dt * 1.5;
      f.vel[i * 3 + 2] *= 1 - dt * 2.5;
      f.pos[i * 3] += f.vel[i * 3] * dt;
      f.pos[i * 3 + 1] += f.vel[i * 3 + 1] * dt;
      f.pos[i * 3 + 2] += f.vel[i * 3 + 2] * dt;
    }
    f.geo.attributes.position.needsUpdate = true;
    f.geo.attributes.aAge.needsUpdate = true;
    f.geo.attributes.aSize.needsUpdate = true;
    f.geo.attributes.aHeat.needsUpdate = true;
  }

  private updateSmoke(dt: number, fx: number) {
    const p = this.p!;
    const s = this.smoke;
    const soot = p.result.sootiness;
    const count = Math.floor(this.strength * soot * 70 * dt + Math.random() * (this.strength > 0.1 ? 0.6 : 0));
    this.emit(s, count, (i) => {
      s.pos[i * 3] = fx + 1 + Math.random() * p.result.flameLen;
      s.pos[i * 3 + 1] = (Math.random() - 0.5) * H + p.gravity * 3;
      s.pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
      s.vel[i * 3] = p.flow * 0.9 + (Math.random() - 0.5);
      s.vel[i * 3 + 1] = p.gravity * 4 + (Math.random() - 0.5);
      s.vel[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      s.age[i] = 0;
      s.life[i] = 2.5 + Math.random() * 2;
      s.size[i] = 2 + Math.random() * 2;
      s.heat[i] = 0;
    });
    for (let i = 0; i < s.age.length; i++) {
      if (s.age[i] >= 1) continue;
      s.age[i] += dt / s.life[i];
      s.size[i] += dt * 2.2;
      for (let k = 0; k < 3; k++) s.pos[i * 3 + k] += s.vel[i * 3 + k] * dt;
      // contain within the duct
      if (Math.abs(s.pos[i * 3 + 1]) > 6) s.vel[i * 3 + 1] *= -0.3;
      if (s.pos[i * 3] > 22) s.age[i] = 1;
    }
    s.geo.attributes.position.needsUpdate = true;
    s.geo.attributes.aAge.needsUpdate = true;
    s.geo.attributes.aSize.needsUpdate = true;
  }

  private updateTrace(dt: number) {
    const u = this.p!.flow;
    const mat = this.trace.material as THREE.LineBasicMaterial;
    mat.opacity = Math.min(0.55, u / 25) * 0.9;
    const segLen = Math.min(2.4, 0.25 + u * 0.06);
    for (let i = 0; i < N_TRACE; i++) {
      let x = this.traceSeed[i * 3] + u * dt * (0.8 + (i % 5) * 0.08);
      if (x > 22) x -= 44;
      this.traceSeed[i * 3] = x;
      const y = this.traceSeed[i * 3 + 1], z = this.traceSeed[i * 3 + 2];
      this.tracePos.set([x, y, z, x + segLen, y, z], i * 6);
    }
    this.trace.geometry.attributes.position.needsUpdate = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
