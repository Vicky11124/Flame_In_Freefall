// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
"use client";

import { useEffect, useRef, useState } from "react";
import s from "./FlameLab.module.css";
import SITag from "@/components/SITag";

/* A stylised, physics-flavoured flame: gravity controls buoyancy (teardrop -> sphere, soot -> blue),
   oxygen controls size/brightness, the cursor blows a concurrent flow across the flame. */
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uG;
uniform float uO2;
uniform vec2 uWind;
uniform vec2 uCenter;
uniform float uScale;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }

void main(){
  vec2 uv = (gl_FragCoord.xy - uCenter) / (uRes.y * uScale);
  float g = clamp(uG, 0.0, 1.0);
  float gb = pow(g, 0.55);              // buoyancy grows fast from zero
  float o = clamp(uO2, 0.0, 1.0);
  float t = uTime;

  vec2 p = uv;
  float size = 0.13 + 0.09*o;
  float h = max(p.y, 0.0);

  // concurrent flow from the cursor bends the plume downstream
  p.x -= uWind.x * h * (1.6 - 0.6*gb);
  p.y -= uWind.y * h * 0.6;
  p.x -= uWind.x * 0.06 * (1.0 - gb);

  // buoyant flicker: only exists when hot gas rises
  float n = fbm(vec2(p.x*5.0, p.y*3.2 - t*(1.0 + 2.4*gb)));
  float n2 = fbm(vec2(p.x*9.0 + 3.0, p.y*6.0 - t*3.5));
  p.x += (n - 0.5) * 0.16 * gb * smoothstep(0.0, 0.55, h);
  p.x += (n2 - 0.5) * 0.015 * (1.0 - gb);

  float stretch = mix(1.0, 2.15, gb);
  float sy = p.y > 0.0 ? p.y / stretch : p.y / mix(1.0, 0.62, gb);
  float narrow = mix(1.0, 1.0 + 1.9*max(sy, 0.0)/size, gb);
  vec2 q = vec2(p.x * narrow, sy - size*0.30*gb);
  float d = length(q) / size;

  float body = smoothstep(1.05, 0.15, d);
  float shell = smoothstep(1.12, 0.92, d) * (1.0 - smoothstep(0.92, 0.55, d));

  vec3 blue = vec3(0.30, 0.55, 1.00);
  vec3 deep = vec3(0.10, 0.22, 0.85);
  vec3 soot = vec3(1.00, 0.46, 0.12);
  vec3 core = vec3(1.00, 0.86, 0.55);

  float sootAmt = gb * smoothstep(-0.35, 0.55, q.y/size + 0.15);
  vec3 flameCol = mix(mix(deep, blue, shell), mix(soot, core, body*body), sootAmt);
  flameCol = mix(flameCol, vec3(1.0, 0.97, 0.92), o*0.3*body*gb);

  float ug = shell*1.35 + body*0.22;
  float earth = body*1.25 + shell*0.25;
  float intensity = mix(ug, earth, gb) * (0.55 + 0.75*o);
  // blue base at the wick in buoyant flames
  float base = gb * smoothstep(0.5, 0.0, length(vec2(p.x*1.6, p.y + size*0.35))/size) * 0.9;

  float glow = exp(-d*1.9) * (0.25 + 0.45*o);
  vec3 c = flameCol*intensity + blue*base*0.6 + mix(blue*0.5, soot*0.9, gb)*glow*0.55;

  // wick
  float wick = smoothstep(0.010, 0.0, abs(uv.x)) * smoothstep(-0.30, -0.26, uv.y) * smoothstep(-0.02, -0.06, uv.y);
  c += vec3(0.25, 0.22, 0.2) * wick;
  // ember on wick tip
  c += vec3(1.0, 0.5, 0.2) * exp(-length(uv - vec2(0.0, -0.05))*90.0) * 0.6;

  // vignette into the page background
  c = c / (1.0 + c*0.35);
  vec3 bg = vec3(0.043, 0.039, 0.035);
  gl_FragColor = vec4(bg + c, 1.0);
}
`;

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const PRESETS = [
  { id: "earth", label: "Earth kitchen", g: 1, o2: 21 },
  { id: "iss", label: "ISS cabin", g: 0, o2: 21 },
  { id: "moon", label: "Moon habitat", g: 0.165, o2: 30 },
  { id: "rover", label: "Lunar rover", g: 0.165, o2: 34 },
];

function describe(g: number, o2: number) {
  const shape = g < 0.05 ? "spherical, diffusion-fed" : g < 0.5 ? "squat dome - weak buoyancy" : "buoyant teardrop";
  const color = g < 0.05 ? "blue, soot-free" : g < 0.5 ? "blue base, faint yellow tip" : "yellow, sooty";
  const risk = o2 >= 30 ? "high - enriched O2" : o2 >= 24 ? "elevated" : o2 >= 18 ? "nominal" : "suppressed";
  return { shape, color, risk };
}

export default function FlameLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [g, setG] = useState(1);
  const [o2, setO2] = useState(21);
  const [glOk, setGlOk] = useState(true);
  const state = useRef({ g: 1, o2: 21, tg: 1, to2: 21, wind: [0, 0], tw: [0, 0] });

  useEffect(() => {
    state.current.tg = g;
    state.current.to2 = o2;
  }, [g, o2]);

  // Scroll-driven descent: while the hero is pinned, scrolling drains gravity from 1 g to 0 g,
  // until the visitor takes the controls themselves.
  const touched = useRef(false);
  const [auto, setAuto] = useState(true);
  const [alt, setAlt] = useState(0);
  useEffect(() => {
    const host = canvas.current?.closest("[data-scrolly]") as HTMLElement | null;
    if (!host) return;
    const onScroll = () => {
      // progress runs from "hero at top" to "hero 40% scrolled away", while the flame is still in view
      const r = host.getBoundingClientRect();
      const span = Math.max(200, r.height * 0.4);
      const p = Math.max(0, Math.min(1, -r.top / span));
      setAlt(p);
      if (!touched.current) {
        const e = p * p * (3 - 2 * p);
        setG(Math.round((1 - e) * 1000) / 1000);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const take = () => {
    touched.current = true;
    setAuto(false);
  };

  useEffect(() => {
    const el = canvas.current!;
    const gl = el.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) {
      setGlOk(false);
      return;
    }
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setGlOk(false);
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U("uRes"), uTime = U("uTime"), uG = U("uG"), uO2 = U("uO2"), uWind = U("uWind"), uCenter = U("uCenter"), uScale = U("uScale");

    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25) * (el.clientWidth > 900 ? 0.8 : 1);
      el.width = Math.floor(el.clientWidth * dpr);
      el.height = Math.floor(el.clientHeight * dpr);
      gl.viewport(0, 0, el.width, el.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    let last = { x: 0, y: 0, t: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const now = performance.now();
      if (last.t) {
        const dt = Math.max(16, now - last.t);
        const vx = ((e.clientX - last.x) / r.width) * (1000 / dt);
        const vy = -((e.clientY - last.y) / r.height) * (1000 / dt);
        const near = Math.exp(-Math.hypot((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.55) * 2.2);
        state.current.tw = [
          Math.max(-1.2, Math.min(1.2, vx * 0.5 * near)),
          Math.max(-1, Math.min(1, vy * 0.4 * near)),
        ];
      }
      last = { x: e.clientX, y: e.clientY, t: now };
    };
    el.addEventListener("pointermove", onMove);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let prev = performance.now();
    const ease = (k: number, dt: number) => 1 - Math.pow(1 - k, dt * 60);
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const now = performance.now();
      const dt = Math.min(0.5, (now - prev) / 1000);
      prev = now;
      const st = state.current;
      st.g += (st.tg - st.g) * ease(0.06, dt);
      st.o2 += (st.to2 - st.o2) * ease(0.08, dt);
      const decay = Math.pow(0.94, dt * 60);
      st.tw = [st.tw[0] * decay, st.tw[1] * decay];
      st.wind = [st.wind[0] + (st.tw[0] - st.wind[0]) * ease(0.08, dt), st.wind[1] + (st.tw[1] - st.wind[1]) * ease(0.08, dt)];
      const t = reduce ? 0 : (performance.now() - t0) / 1000;
      gl.uniform2f(uRes, el.width, el.height);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uG, st.g);
      gl.uniform1f(uO2, Math.max(0, Math.min(1, (st.o2 - 15) / 25)));
      gl.uniform2f(uWind, st.wind[0], st.wind[1]);
      gl.uniform2f(uCenter, el.width * 0.5, el.height * 0.5);
      gl.uniform1f(uScale, el.width < el.height ? 0.9 : 1.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
    };
  }, []);

  const d = describe(g, o2);
  const preset = PRESETS.find((p) => Math.abs(p.g - g) < 0.01 && p.o2 === o2)?.id;

  return (
    <div className={s.lab}>
      <canvas ref={canvas} className={s.canvas} aria-label="Interactive flame simulation" />
      {!glOk && <div className={s.fallback} aria-hidden />}
      <SITag />

      <div className={s.hud}>
        <span className="eyebrow">Fig. 01 - Flame lab</span>
        <span className="eyebrow">Move your cursor to blow air</span>
      </div>

      {auto && (
        <div className={s.descent} aria-hidden>
          <div className={s.altBar}>
            <span style={{ height: `${alt * 100}%` }} />
          </div>
          <div className={s.altText}>
            <span className="eyebrow">{alt < 0.05 ? "Scroll to leave Earth" : alt > 0.95 ? "In orbit" : "Climbing"}</span>
            <span className="mono num">{g.toFixed(2)} g</span>
          </div>
        </div>
      )}

      <div className={s.readout}>
        <dl>
          <div>
            <dt>Shape</dt>
            <dd>{d.shape}</dd>
          </div>
          <div>
            <dt>Color</dt>
            <dd>{d.color}</dd>
          </div>
          <div>
            <dt>Fire risk</dt>
            <dd className={o2 >= 30 ? "hot" : undefined}>{d.risk}</dd>
          </div>
        </dl>
      </div>

      <div className={s.controls}>
        <div className={s.presets}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`${s.preset} ${preset === p.id ? s.on : ""}`}
              onClick={() => {
                take();
                setG(p.g);
                setO2(p.o2);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className={s.slider}>
          <span className={s.sl}>
            <span className="eyebrow">Gravity</span>
            <span className="mono num">{g.toFixed(2)} g</span>
          </span>
          <input type="range" min={0} max={1} step={0.005} value={g} onChange={(e) => {
              take();
              setG(+e.target.value);
            }} aria-label="Gravity" />
          <span className={s.ticks}>
            <span>0 orbit</span>
            <span>0.17 Moon</span>
            <span>0.38 Mars</span>
            <span>1 Earth</span>
          </span>
        </label>
        <label className={s.slider}>
          <span className={s.sl}>
            <span className="eyebrow">Oxygen</span>
            <span className="mono num">{o2.toFixed(0)}%</span>
          </span>
          <input type="range" min={15} max={40} step={0.5} value={o2} onChange={(e) => setO2(+e.target.value)} aria-label="Oxygen" />
          <span className={s.ticks}>
            <span>15%</span>
            <span>21% Earth</span>
            <span>30-34% Moon</span>
            <span>40%</span>
          </span>
        </label>
        <p className={s.disclaimer}>
          Illustrative model. Microgravity (0 g) and Earth (1 g) shapes match ISS imagery; partial gravity is interpolated -
          PSI has no partial-gravity data yet.
        </p>
      </div>
    </div>
  );
}
