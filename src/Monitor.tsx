import { Fragment, useEffect, useRef, useState } from "react";
import type { ScenePalette, BackdropKind } from "./lighting";
import { blurDisc } from "./optics";
import type { Look } from "./looks";
import type { Illu, IlluSet } from "./illustrations";

// Simulated camera monitor (16:9 for video, sensor aspect for photo).
// World units are metres, measured from the camera.

const W = 320;
const EYE = 1.5; // camera height

export type SubjectKind = "person" | "couple" | "group1" | "group2" | "group3";

/** Distance between rows in a group photo, metres. */
export const ROW_GAP = 0.8;

export function rowCount(kind: SubjectKind) {
  return kind === "group3" ? 3 : kind === "group2" ? 2 : 1;
}

type Figure = {
  x: number;
  h: number;
  dress?: boolean;
  bride?: boolean;
  groom?: boolean;
  tone: string; // suit or dress colour
  skin: string;
  hair: string;
  longHair?: boolean;
  eyes?: string;
};
type Row = { offset: number; figures: Figure[] };

const SUITS = ["#22252d", "#2f3d52", "#3b3f46", "#1f2a24", "#4a3b33"];
const DRESSES = ["#8a3b4c", "#3d5a80", "#c9a46a", "#5b7f6e", "#7b5ea7", "#c97b84"];
const SKINS = ["#e8b896", "#c99272", "#a8714f", "#f0c8a8", "#8a5a3c", "#d9a582"];
const HAIRS = ["#2a1d16", "#4a3020", "#121010", "#7a5230", "#b08850", "#3a2a22"];

function person(i: number, x: number, dress: boolean, extra: Partial<Figure> = {}): Figure {
  return {
    x,
    h: dress ? 1.64 + ((i * 7) % 5) * 0.02 : 1.76 + ((i * 3) % 4) * 0.025,
    dress,
    tone: dress ? DRESSES[i % DRESSES.length] : SUITS[i % SUITS.length],
    skin: SKINS[(i * 5 + 1) % SKINS.length],
    hair: HAIRS[(i * 3 + 2) % HAIRS.length],
    longHair: dress && i % 3 !== 1,
    eyes: ["#4a2f1e", "#3c5a6e", "#5a4a2a", "#2e1f16", "#4f6a4a"][(i * 3) % 5],
    ...extra,
  };
}

function rows(kind: SubjectKind): Row[] {
  if (kind === "person") return [{ offset: 0, figures: [person(0, 0, false, { tone: "#2c3340", h: 1.78 })] }];
  if (kind === "couple")
    return [
      {
        offset: 0,
        figures: [
          person(1, -0.27, false, { groom: true, tone: "#1d2433", h: 1.82, skin: "#e3ad8a", hair: "#c99540" }),
          person(2, 0.25, true, { bride: true, tone: "#f4efe7", h: 1.66, skin: "#efc7a6", hair: "#5a3a26", longHair: true }),
        ],
      },
    ];
  const n = rowCount(kind);
  return Array.from({ length: n }, (_, r) => {
    const count = 5 + r;
    const shift = r % 2 ? 0.27 : 0;
    return {
      offset: r * ROW_GAP,
      figures: Array.from({ length: count }, (_, i) =>
        person(i + r * 7, (i - (count - 1) / 2) * 0.55 + shift, (i + r) % 2 === 1)
      ),
    };
  });
}

export type MeterInput = { avg: number; peak: number; clip: boolean; limiting: boolean; stereo?: boolean };

type Props = {
  mode: "photo" | "video";
  aspect: number; // width / height of the frame
  meter?: MeterInput;
  focal: number; // mm
  aperture: number;
  focusM: number; // focus distance (front row) in metres
  frameHeightMM: number; // height of the frame on the sensor
  cocMM: number;
  subject: SubjectKind;
  palette: ScenePalette;
  backdrop: BackdropKind;
  photo?: string; // background photo URL
  illu?: IlluSet; // illustrated people instead of the drawn figures
  exposureDelta: number;
  cast: [number, number, number];
  grain: number;
  logView: boolean;
  look: Look; // picture profile or monitoring LUT (Rec.709 view)
  assist: Assist;
  skew: number; // rolling-shutter lean in degrees
  cpl: number;
  uv: boolean;
  hud: { fps: string; shutter: string; iso: string; focus: string; profile: string; filters: string; wb: string };
  label: string;
};

/** An illustrated person standing on the ground at x (metres), head top at heightM. */
function IlluPerson({ pic, x, heightM, flip }: { pic: Illu; x: number; heightM: number; flip?: boolean }) {
  const wM = (heightM * pic.w) / pic.h;
  return (
    <g transform={`translate(${x} 0)`}>
      <ellipse cx={0} cy={0} rx={wM * 0.42} ry={0.05} fill="url(#m-shadow)" />
      <image href={pic.href} x={-wM / 2} y={-heightM} width={wM} height={heightM} preserveAspectRatio="none" transform={flip ? "scale(-1 1)" : undefined} />
    </g>
  );
}

/** Exposure and framing tools drawn on the monitor. */
export type Assist = {
  zebras: { lo: number; hi: number; dir: 1 | -1 }[]; // picture levels 0–1; dir = stripe direction
  falseColor: boolean;
  wfm: "off" | "wave" | "vector";
  histogram: boolean;
  peaking: boolean;
  frames: { ratio: number; color: string }[]; // frame markers; the first one gets the mask
  frameMask: number; // 0–1
};

// False colour bands by IRE: [from %, r, g, b] – null = grey picture
const FALSE_COLOR: [number, [number, number, number] | null][] = [
  [0, [0.5, 0, 0.8]], [2, [0, 0.35, 1]], [8, null], [38, [0.15, 0.8, 0.2]], [45, null],
  [52, [1, 0.5, 0.75]], [58, null], [93, [1, 0.9, 0]], [98, [1, 0, 0]],
];
const fcTables = (() => {
  const out: [number[], number[], number[]] = [[], [], []];
  for (let i = 0; i <= 100; i++) {
    let band = FALSE_COLOR[0][1];
    for (const [from, c] of FALSE_COLOR) if (i >= from) band = c;
    for (let ch = 0; ch < 3; ch++) out[ch].push(band ? band[ch] : (i / 100) * 0.8);
  }
  return out.map((a) => a.map((v) => v.toFixed(3)).join(" "));
})();
const LUMA_RGB = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
const LUMA_ALPHA = "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2126 0.7152 0.0722 0 0";
const zebraTile = (path: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><rect width='6' height='6' fill='#111'/><path d='${path}' stroke='#fff' stroke-width='1.6'/></svg>`
  );
const ZEBRA_TILES = {
  1: zebraTile("M-1.5 1.5l3-3M0 6L6 0M4.5 7.5l3-3"),
  [-1]: zebraTile("M-1.5 4.5l3 3M0 0L6 6M4.5 -1.5l3 3"),
} as Record<number, string>;

// Photos used on the monitor, as data URLs (an SVG drawn into a canvas cannot load external files)
const INLINE = new Map<string, string>();
async function inlineImage(href: string) {
  if (INLINE.has(href)) return;
  const blob = await (await fetch(href)).blob();
  const data = await new Promise<string>((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.readAsDataURL(blob);
  });
  INLINE.set(href, data);
}

/** Rasterises the picture (without overlays) and draws waveform, histogram and focus peaking. */
function useScopes(svgRef: React.RefObject<SVGSVGElement>, canvasRef: React.RefObject<HTMLCanvasElement>, a: Assist, H: number, key: string) {
  const on = a.wfm !== "off" || a.histogram || a.peaking;
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    if (!on) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const SW = W * 2;
      const SH = Math.round(H * 2);
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll("[data-noscan],[data-assist]").forEach((n) => n.remove());
      const missing: string[] = [];
      for (const im of clone.querySelectorAll("image")) {
        const href = im.getAttribute("href") ?? "";
        if (href.startsWith("data:")) continue;
        const data = INLINE.get(href);
        if (data) im.setAttribute("href", data);
        else missing.push(href);
      }
      if (missing.length) {
        Promise.all([...new Set(missing)].map(inlineImage)).then(() => setRetry((r) => r + 1));
        return;
      }
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(SW));
      clone.setAttribute("height", String(SH));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (cancelled) return;
        try {
          const off = document.createElement("canvas");
          off.width = SW;
          off.height = SH;
          const octx = off.getContext("2d")!;
          octx.drawImage(img, 0, 0, SW, SH);
          const src = octx.getImageData(0, 0, SW, SH).data;
          const lum = new Float32Array(SW * SH);
          for (let i = 0; i < SW * SH; i++) lum[i] = (0.2126 * src[i * 4] + 0.7152 * src[i * 4 + 1] + 0.0722 * src[i * 4 + 2]) / 255;
          cv.width = SW;
          cv.height = SH;
          ctx.clearRect(0, 0, SW, SH);
          if (a.peaking) drawPeaking(ctx, lum, SW, SH);
          if (a.wfm === "wave") drawWaveform(ctx, lum, SW, SH);
          if (a.wfm === "vector") drawVector(ctx, src, SW, SH);
          if (a.histogram) drawHistogram(ctx, lum, SW, SH);
        } catch {
          /* canvas blocked by the browser – scopes stay hidden */
        }
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, on, a.peaking, a.wfm, a.histogram, H, svgRef, canvasRef, retry]);
}

function drawPeaking(ctx: CanvasRenderingContext2D, lum: Float32Array, SW: number, SH: number) {
  const out = ctx.createImageData(SW, SH);
  for (let y = 1; y < SH - 1; y++)
    for (let x = 1; x < SW - 1; x++) {
      const i = y * SW + x;
      const gx = lum[i - SW + 1] + 2 * lum[i + 1] + lum[i + SW + 1] - lum[i - SW - 1] - 2 * lum[i - 1] - lum[i + SW - 1];
      const gy = lum[i + SW - 1] + 2 * lum[i + SW] + lum[i + SW + 1] - lum[i - SW - 1] - 2 * lum[i - SW] - lum[i - SW + 1];
      if (gx * gx + gy * gy > 0.25) {
        out.data[i * 4] = 255;
        out.data[i * 4 + 1] = 40;
        out.data[i * 4 + 2] = 40;
        out.data[i * 4 + 3] = 255;
      }
    }
  ctx.putImageData(out, 0, 0);
}

function scopeBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawWaveform(ctx: CanvasRenderingContext2D, lum: Float32Array, SW: number, SH: number) {
  const w = Math.round(SW * 0.36);
  const h = Math.round(SH * 0.3);
  const x0 = SW - w - 8;
  const y0 = SH - h - 36;
  scopeBox(ctx, x0, y0, w, h);
  const cols = w - 4;
  const rows = h - 4;
  const bins = new Uint16Array(cols * rows);
  for (let y = 0; y < SH; y += 2)
    for (let x = 0; x < SW; x++) {
      const c = Math.min(cols - 1, Math.floor((x / SW) * cols));
      const r = Math.min(rows - 1, Math.floor((1 - lum[y * SW + x]) * (rows - 1)));
      bins[r * cols + c]++;
    }
  const img = ctx.getImageData(x0 + 2, y0 + 2, cols, rows);
  for (let i = 0; i < cols * rows; i++) {
    if (!bins[i]) continue;
    const v = Math.min(1, 0.25 + bins[i] / 12);
    img.data[i * 4] = Math.round(img.data[i * 4] * (1 - v) + 140 * v);
    img.data[i * 4 + 1] = Math.round(img.data[i * 4 + 1] * (1 - v) + 255 * v);
    img.data[i * 4 + 2] = Math.round(img.data[i * 4 + 2] * (1 - v) + 160 * v);
  }
  ctx.putImageData(img, x0 + 2, y0 + 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "9px ui-monospace, monospace";
  for (const ire of [100, 70, 50, 0]) {
    const yy = y0 + 2 + (1 - ire / 100) * (rows - 1);
    ctx.fillRect(x0 + 2, yy, cols, 0.6);
    ctx.fillText(String(ire), x0 + 4, Math.max(y0 + 10, Math.min(yy - 2, y0 + h - 4)));
  }
}

function drawVector(ctx: CanvasRenderingContext2D, rgb: Uint8ClampedArray, SW: number, SH: number) {
  const size = Math.round(SH * 0.42);
  const x0 = SW - size - 8;
  const y0 = SH - size - 36;
  scopeBox(ctx, x0, y0, size, size);
  const cx = x0 + size / 2;
  const cy = y0 + size / 2;
  const R = size / 2 - 4;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.stroke();
  // skin tone line (about 123° in the Cb/Cr plane)
  ctx.strokeStyle = "rgba(255,190,140,0.7)";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + R * Math.cos((-123 * Math.PI) / 180), cy + R * Math.sin((-123 * Math.PI) / 180));
  ctx.stroke();
  const img = ctx.getImageData(x0, y0, size, size);
  for (let i = 0; i < rgb.length; i += 4 * 3) {
    const r = rgb[i] / 255, g = rgb[i + 1] / 255, b = rgb[i + 2] / 255;
    const cb = -0.1146 * r - 0.3854 * g + 0.5 * b;
    const cr = 0.5 * r - 0.4542 * g - 0.0458 * b;
    const px = Math.round(size / 2 + cb * 2 * R);
    const py = Math.round(size / 2 - cr * 2 * R);
    if (px < 0 || py < 0 || px >= size || py >= size) continue;
    const j = (py * size + px) * 4;
    img.data[j] = Math.min(255, img.data[j] + 40);
    img.data[j + 1] = Math.min(255, img.data[j + 1] + 70);
    img.data[j + 2] = Math.min(255, img.data[j + 2] + 45);
  }
  ctx.putImageData(img, x0, y0);
}

function drawHistogram(ctx: CanvasRenderingContext2D, lum: Float32Array, SW: number, SH: number) {
  const w = Math.round(SW * 0.3);
  const h = Math.round(SH * 0.2);
  const x0 = 8;
  const y0 = 36;
  scopeBox(ctx, x0, y0, w, h);
  const n = w - 4;
  const hist = new Float32Array(n);
  for (let i = 0; i < lum.length; i += 3) hist[Math.min(n - 1, Math.floor(lum[i] * n))]++;
  const max = Math.max(...hist.slice(1, n - 1), 1);
  ctx.fillStyle = "rgba(235,235,235,0.85)";
  for (let i = 0; i < n; i++) {
    const v = Math.min(1, hist[i] / max) * (h - 6);
    ctx.fillRect(x0 + 2 + i, y0 + h - 2 - v, 1, v);
  }
  if (hist[n - 1] > lum.length / 300) {
    ctx.fillStyle = "#ff4040";
    ctx.fillRect(x0 + w - 5, y0 + 2, 3, h - 4);
  }
  if (hist[0] > lum.length / 300) {
    ctx.fillStyle = "#4080ff";
    ctx.fillRect(x0 + 2, y0 + 2, 3, h - 4);
  }
}

/** A standing figure, feet at y = 0, drawn upward (negative y), facing the camera.
 *  Fashion-illustration proportions (8 heads), soft shading instead of outlines. */
function FigureShape({ f }: { f: Figure }) {
  const u = f.h / 8; // head height
  const top = -f.h;
  const woman = !!f.dress;

  // ── body landmarks
  const hu = u * 1.15; // a slightly larger, friendlier head
  const R = hu * (woman ? 0.36 : 0.38); // half head width
  const ry = hu * 0.5;
  const cy = top + ry; // head centre
  const chinY = top + hu;
  const neckY = chinY + u * 0.18; // base of the neck
  const shY = neckY + u * (woman ? 0.22 : 0.18); // shoulder tip
  const sw = u * (woman ? 0.8 : 1.0); // half shoulder width
  const chestY = top + u * 2.1;
  const waistY = top + u * (woman ? 2.95 : 3.1);
  const hipY = top + u * (woman ? 3.75 : 3.9);
  const crotchY = top + u * 4.05;
  const kneeY = top + u * 5.9;
  const ankleY = -u * 0.12;
  const nw = u * (woman ? 0.12 : 0.17); // half neck width
  const shade = "rgba(90,45,25,0.18)";
  const OL = "rgba(95,50,30,0.3)"; // very soft outline
  const olw = u * 0.014;
  const P = (x: number, y: number) => `${x} ${y}`;

  // ── head
  const face = `M${P(0, cy - ry)} C${P(R * 0.62, cy - ry)} ${P(R, cy - ry * 0.6)} ${P(R, cy - ry * 0.12)}
    C${P(R, cy + ry * 0.28)} ${P(R * (woman ? 0.86 : 0.92), cy + ry * 0.55)} ${P(R * (woman ? 0.58 : 0.66), cy + ry * 0.8)}
    C${P(R * 0.38, cy + ry * 0.97)} ${P(R * 0.16, chinY)} ${P(0, chinY)}
    C${P(-R * 0.16, chinY)} ${P(-R * 0.38, cy + ry * 0.97)} ${P(-R * (woman ? 0.58 : 0.66), cy + ry * 0.8)}
    C${P(-R * (woman ? 0.86 : 0.92), cy + ry * 0.55)} ${P(-R, cy + ry * 0.28)} ${P(-R, cy - ry * 0.12)}
    C${P(-R, cy - ry * 0.6)} ${P(-R * 0.62, cy - ry)} ${P(0, cy - ry)} Z`;
  const neck = `M${P(-nw, cy + ry * 0.5)} C${P(-nw, chinY + u * 0.08)} ${P(-nw * 1.1, neckY - u * 0.05)} ${P(-nw * 1.9, neckY + u * 0.08)}
    L${P(nw * 1.9, neckY + u * 0.08)} C${P(nw * 1.1, neckY - u * 0.05)} ${P(nw, chinY + u * 0.08)} ${P(nw, cy + ry * 0.5)} Z`;
  const eyeY = cy + ry * 0.06;
  const brow = (s: 1 | -1) =>
    `M${P(s * R * 0.14, eyeY - ry * 0.2)} Q${P(s * R * 0.4, eyeY - ry * (woman ? 0.32 : 0.3))} ${P(s * R * 0.66, eyeY - ry * 0.2)}`;
  const eyeColor = f.bride ? "#4f86c6" : f.eyes ?? "#6b4226";
  const bigEye = (s: 1 | -1) => {
    const x = s * R * 0.4;
    const er = woman ? 1 : 0.82;
    return (
      <g>
        <ellipse cx={x} cy={eyeY} rx={R * 0.2 * er} ry={ry * 0.13 * er} fill="#ffffff" />
        <circle cx={x} cy={eyeY + ry * 0.015} r={ry * 0.11 * er} fill={eyeColor} />
        <circle cx={x} cy={eyeY + ry * 0.04} r={ry * 0.07 * er} fill="#ffffff" opacity={0.18} />
        <circle cx={x} cy={eyeY + ry * 0.015} r={ry * 0.055 * er} fill="#140c08" />
        <circle cx={x - R * 0.05} cy={eyeY - ry * 0.035} r={ry * 0.03 * er} fill="#ffffff" />
        <circle cx={x + R * 0.05} cy={eyeY + ry * 0.05} r={ry * 0.013 * er} fill="#ffffff" opacity={0.8} />
        <path d={`M${P(x - R * 0.21 * er, eyeY + ry * 0.01)} Q${P(x, eyeY - ry * 0.19 * er)} ${P(x + R * 0.22 * er, eyeY - ry * 0.01)}`} stroke="#1e100a" strokeWidth={u * (woman ? 0.036 : 0.026)} fill="none" strokeLinecap="round" />
        {woman && (
          <path d={`M${P(x + s * R * 0.2, eyeY - ry * 0.03)} l${P(s * R * 0.08, -ry * 0.06)} M${P(x + s * R * 0.12, eyeY - ry * 0.09)} l${P(s * R * 0.05, -ry * 0.07)}`} stroke="#1e100a" strokeWidth={u * 0.018} strokeLinecap="round" />
        )}
        <path d={`M${P(x - R * 0.15 * er, eyeY + ry * 0.11 * er)} Q${P(x, eyeY + ry * 0.16 * er)} ${P(x + R * 0.15 * er, eyeY + ry * 0.11 * er)}`} stroke="rgba(60,30,20,0.35)" strokeWidth={u * 0.01} fill="none" />
        <path d={`M${P(x - R * 0.17, eyeY - ry * 0.16)} Q${P(x, eyeY - ry * 0.24)} ${P(x + R * 0.17, eyeY - ry * 0.15)}`} stroke={shade} strokeWidth={u * 0.012} fill="none" />
      </g>
    );
  };
  const mouthY = cy + ry * 0.58;
  const mw = R * (woman ? 0.24 : 0.28);
  const lipUp = `M${P(-mw, mouthY)} Q${P(-mw * 0.4, mouthY - ry * 0.05)} ${P(0, mouthY - ry * 0.02)} Q${P(mw * 0.4, mouthY - ry * 0.05)} ${P(mw, mouthY)} Q${P(0, mouthY + ry * 0.03)} ${P(-mw, mouthY)} Z`;
  const lipLow = `M${P(-mw * 0.85, mouthY + ry * 0.01)} Q${P(0, mouthY + ry * 0.12)} ${P(mw * 0.85, mouthY + ry * 0.01)} Q${P(0, mouthY + ry * 0.035)} ${P(-mw * 0.85, mouthY + ry * 0.01)} Z`;
  const headDetails = (
    <g>
      {[-1, 1].map((sd) => (
        <ellipse key={sd} cx={sd * R * 0.98} cy={eyeY + ry * 0.12} rx={R * 0.13} ry={ry * 0.19} fill={f.skin} stroke={OL} strokeWidth={olw} />
      ))}
      <path d={face} fill={f.skin} stroke={OL} strokeWidth={olw} />
      <path d={face} fill="url(#m-face)" opacity={0.6} />
      <ellipse cx={-R * 0.55} cy={eyeY + ry * 0.32} rx={R * 0.2} ry={ry * 0.1} fill="#f08f94" opacity={woman ? 0.32 : 0.16} />
      <ellipse cx={R * 0.55} cy={eyeY + ry * 0.32} rx={R * 0.2} ry={ry * 0.1} fill="#f08f94" opacity={woman ? 0.32 : 0.16} />
      <path d={brow(-1)} stroke={f.hair} strokeWidth={u * (woman ? 0.022 : 0.034)} strokeLinecap="round" fill="none" opacity={0.85} />
      <path d={brow(1)} stroke={f.hair} strokeWidth={u * (woman ? 0.022 : 0.034)} strokeLinecap="round" fill="none" opacity={0.85} />
      {bigEye(-1)}
      {bigEye(1)}
      <path d={`M${P(-R * 0.02, eyeY + ry * 0.24)} Q${P(R * 0.08, eyeY + ry * 0.38)} ${P(-R * 0.05, eyeY + ry * 0.41)}`} stroke="rgba(120,60,40,0.4)" strokeWidth={u * 0.013} fill="none" strokeLinecap="round" />
      <path d={lipUp} fill={woman ? "#c25d68" : "#b27265"} opacity={woman ? 0.95 : 0.6} />
      <path d={lipLow} fill={woman ? "#d27380" : "#c08273"} opacity={woman ? 0.9 : 0.5} />
      <path d={`M${P(-mw, mouthY)} q${P(-R * 0.04, -ry * 0.03)} ${P(-R * 0.06, -ry * 0.05)} M${P(mw, mouthY)} q${P(R * 0.04, -ry * 0.03)} ${P(R * 0.06, -ry * 0.05)}`} stroke="rgba(110,50,40,0.45)" strokeWidth={u * 0.01} fill="none" strokeLinecap="round" />
    </g>
  );

  // ── hair
  const manHair = `M${P(-R * 1.02, cy + ry * 0.02)} C${P(-R * 1.12, cy - ry * 0.7)} ${P(-R * 0.62, cy - ry * 1.18)} ${P(R * 0.1, cy - ry * 1.14)}
    C${P(R * 0.78, cy - ry * 1.12)} ${P(R * 1.14, cy - ry * 0.72)} ${P(R * 1.02, cy + ry * 0.02)}
    L${P(R * 0.95, cy - ry * 0.05)} C${P(R * 0.9, cy - ry * 0.45)} ${P(R * 0.62, cy - ry * 0.6)} ${P(R * 0.15, cy - ry * 0.66)}
    C${P(-R * 0.3, cy - ry * 0.76)} ${P(-R * 0.84, cy - ry * 0.52)} ${P(-R * 0.95, cy - ry * 0.05)} Z`;
  const longFront = `M${P(-R * 1.06, cy + ry * 0.6)} C${P(-R * 1.2, cy - ry * 0.6)} ${P(-R * 0.75, cy - ry * 1.2)} ${P(R * 0.05, cy - ry * 1.15)}
    C${P(R * 0.8, cy - ry * 1.13)} ${P(R * 1.2, cy - ry * 0.6)} ${P(R * 1.06, cy + ry * 0.6)}
    C${P(R * 0.98, cy - ry * 0.1)} ${P(R * 0.7, cy - ry * 0.55)} ${P(R * 0.05, cy - ry * 0.72)}
    C${P(-R * 0.5, cy - ry * 0.55)} ${P(-R * 0.98, cy - ry * 0.1)} ${P(-R * 1.06, cy + ry * 0.6)} Z`;
  const longBack = `M${P(-R * 1.1, cy - ry * 0.3)} C${P(-R * 1.45, cy + ry * 0.7)} ${P(-R * 1.4, neckY + u * 0.6)} ${P(-R * 0.95, neckY + u * 1.0)}
    L${P(R * 0.95, neckY + u * 1.0)} C${P(R * 1.4, neckY + u * 0.6)} ${P(R * 1.45, cy + ry * 0.7)} ${P(R * 1.1, cy - ry * 0.3)} Z`;
  const updo = `M${P(-R * 1.04, cy + ry * 0.12)} C${P(-R * 1.14, cy - ry * 0.8)} ${P(-R * 0.6, cy - ry * 1.15)} ${P(0, cy - ry * 1.12)}
    C${P(R * 0.6, cy - ry * 1.15)} ${P(R * 1.14, cy - ry * 0.8)} ${P(R * 1.04, cy + ry * 0.12)}
    C${P(R * 0.94, cy - ry * 0.3)} ${P(R * 0.6, cy - ry * 0.62)} ${P(R * 0.05, cy - ry * 0.66)}
    C${P(-R * 0.55, cy - ry * 0.6)} ${P(-R * 0.94, cy - ry * 0.3)} ${P(-R * 1.04, cy + ry * 0.12)} Z`;

  // ── arms (sleeve or bare), hanging with a slight bend at the elbow
  const arm = (s: 1 | -1) => {
    const [w0, w1, w2] = woman ? [u * 0.24, u * 0.16, u * 0.1] : [u * 0.34, u * 0.28, u * 0.22];
    const sx = s * (sw - w0 * 0.35), sy = shY + u * 0.08;
    const ex = s * (sw + u * (woman ? 0.0 : 0.04)), ey = waistY - u * 0.05;
    const wx = s * (sw - u * (woman ? 0.06 : 0.04)), wy = hipY + u * (woman ? 0.25 : 0.2);
    const d = `M${P(sx - (s * w0) / 2, sy + u * 0.12)} Q${P(sx + s * w0 * 0.1, sy - u * 0.14)} ${P(sx + (s * w0) / 2, sy + u * 0.1)}
      Q${P(ex + (s * w1) / 2 + s * u * 0.02, ey)} ${P(wx + (s * w2) / 2, wy)}
      L${P(wx - (s * w2) / 2, wy)} Q${P(ex - (s * w1) / 2, ey)} ${P(sx - (s * w0) / 2, sy + u * 0.12)} Z`;
    const hx = wx, hy = wy + u * 0.02;
    const hand = `M${P(hx - u * 0.085, hy - u * 0.04)} C${P(hx - u * 0.1, hy + u * 0.12)} ${P(hx - u * 0.05, hy + u * 0.25)} ${P(hx + s * u * 0.01, hy + u * 0.26)}
      C${P(hx + u * 0.08, hy + u * 0.24)} ${P(hx + u * 0.1, hy + u * 0.1)} ${P(hx + u * 0.085, hy - u * 0.04)} Z`;
    return (
      <g>
        <path d={d} fill={woman ? f.skin : f.tone} stroke={woman ? OL : "rgba(0,0,0,0.55)"} strokeWidth={olw} />
        <path d={d} fill="url(#m-cyl)" opacity={woman ? 0.7 : 1} />
        {f.bride && <path d={d} fill="#ffffff" opacity={0.3} />}
        {f.bride && <path d={d} fill="url(#m-lace)" opacity={0.6} />}
        {!woman && <rect x={wx - u * 0.1} y={wy - u * 0.05} width={u * 0.2} height={u * 0.06} rx={u * 0.02} fill="#efede8" />}
        <path d={hand} fill={f.skin} stroke={OL} strokeWidth={olw} />
        <path d={hand} fill="url(#m-cyl)" opacity={0.5} />
      </g>
    );
  };

  // ── man: trousers, shoes, jacket
  const leg = (s: 1 | -1) =>
    `M${P(s * u * 0.04, crotchY)} L${P(s * sw * 0.8, hipY)} C${P(s * sw * 0.8, kneeY - u * 1.0)} ${P(s * u * 0.62, kneeY)} ${P(s * u * 0.5, ankleY)}
     L${P(s * u * 0.13, ankleY)} C${P(s * u * 0.12, kneeY)} ${P(s * u * 0.08, crotchY + u * 0.6)} ${P(s * u * 0.04, crotchY)} Z`;
  const shoe = (s: 1 | -1) =>
    `M${P(s * u * 0.1, ankleY - u * 0.02)} L${P(s * u * 0.52, ankleY - u * 0.02)} C${P(s * u * 0.6, ankleY + u * 0.02)} ${P(s * u * 0.58, u * 0.0)} ${P(s * u * 0.5, 0)} L${P(s * u * 0.12, 0)} C${P(s * u * 0.06, 0)} ${P(s * u * 0.06, ankleY)} ${P(s * u * 0.1, ankleY - u * 0.02)} Z`;
  const collarY = neckY - u * 0.12;
  const jacket = `M${P(-u * 0.2, collarY)} C${P(-u * 0.5, collarY + u * 0.04)} ${P(-sw * 0.82, shY - u * 0.06)} ${P(-sw, shY + u * 0.08)}
    C${P(-sw * 1.06, shY + u * 0.5)} ${P(-sw * 0.98, chestY + u * 0.3)} ${P(-sw * 0.8, waistY)}
    C${P(-sw * 0.76, waistY + u * 0.4)} ${P(-sw * 0.84, hipY)} ${P(-sw * 0.84, hipY + u * 0.35)}
    L${P(sw * 0.84, hipY + u * 0.35)} C${P(sw * 0.84, hipY)} ${P(sw * 0.76, waistY + u * 0.4)} ${P(sw * 0.8, waistY)}
    C${P(sw * 0.98, chestY + u * 0.3)} ${P(sw * 1.06, shY + u * 0.5)} ${P(sw, shY + u * 0.08)}
    C${P(sw * 0.82, shY - u * 0.06)} ${P(u * 0.5, collarY + u * 0.04)} ${P(u * 0.2, collarY)} Z`;
  const vBottom = waistY - u * 0.18;

  // ── woman: legs, shoulders, bodice, skirt
  const skirtBottom = f.bride ? u * 0.02 : top + u * 5.6;
  const skirtW = f.bride ? u * 1.5 : u * 0.88;
  const womanLeg = (s: 1 | -1) =>
    `M${P(s * u * 0.08, skirtBottom - u * 0.1)} L${P(s * u * 0.3, skirtBottom - u * 0.1)} C${P(s * u * 0.33, skirtBottom + u * 0.6)} ${P(s * u * 0.25, ankleY - u * 0.6)} ${P(s * u * 0.2, ankleY)}
     L${P(s * u * 0.12, ankleY)} C${P(s * u * 0.1, ankleY - u * 0.7)} ${P(s * u * 0.06, skirtBottom + u * 0.5)} ${P(s * u * 0.08, skirtBottom - u * 0.1)} Z`;
  const heel = (s: 1 | -1) =>
    `M${P(s * u * 0.1, ankleY - u * 0.03)} L${P(s * u * 0.23, ankleY - u * 0.03)} L${P(s * u * 0.25, 0)} L${P(s * u * 0.09, 0)} Z`;
  const shoulders = `M${P(-nw * 1.6, neckY)} C${P(-u * 0.4, neckY + u * 0.02)} ${P(-sw * 0.85, shY - u * 0.08)} ${P(-sw * 0.97, shY + u * 0.1)}
    C${P(-sw * 0.98, shY + u * 0.22)} ${P(-sw * 0.88, shY + u * 0.36)} ${P(-sw * 0.74, shY + u * 0.4)}
    L${P(sw * 0.74, shY + u * 0.4)} C${P(sw * 0.88, shY + u * 0.36)} ${P(sw * 0.98, shY + u * 0.22)} ${P(sw * 0.97, shY + u * 0.1)}
    C${P(sw * 0.85, shY - u * 0.08)} ${P(u * 0.4, neckY + u * 0.02)} ${P(nw * 1.6, neckY)} Z`;
  const bustY = shY + u * 0.62;
  const bodiceTop = f.bride ? bustY - u * 0.12 : neckY + u * 0.02;
  const bodice = f.bride
    ? `M${P(-sw * 0.7, bodiceTop)} Q${P(-sw * 0.35, bodiceTop - u * 0.16)} ${P(0, bodiceTop + u * 0.08)} Q${P(sw * 0.35, bodiceTop - u * 0.16)} ${P(sw * 0.7, bodiceTop)}
       C${P(sw * 0.74, bustY + u * 0.3)} ${P(sw * 0.58, waistY - u * 0.3)} ${P(sw * 0.56, waistY)} L${P(-sw * 0.56, waistY)}
       C${P(-sw * 0.58, waistY - u * 0.3)} ${P(-sw * 0.74, bustY + u * 0.3)} ${P(-sw * 0.7, bodiceTop)} Z`
    : `M${P(-u * 0.17, bodiceTop)} C${P(-u * 0.45, bodiceTop + u * 0.02)} ${P(-sw * 0.88, shY - u * 0.04)} ${P(-sw * 0.96, shY + u * 0.2)}
       C${P(-sw * 0.98, bustY)} ${P(-sw * 0.64, waistY - u * 0.3)} ${P(-sw * 0.56, waistY)} L${P(sw * 0.56, waistY)}
       C${P(sw * 0.64, waistY - u * 0.3)} ${P(sw * 0.98, bustY)} ${P(sw * 0.96, shY + u * 0.2)}
       C${P(sw * 0.88, shY - u * 0.04)} ${P(u * 0.45, bodiceTop + u * 0.02)} ${P(u * 0.17, bodiceTop)} Z`;
  const skirt = `M${P(-sw * 0.56, waistY)} C${P(-sw * 0.98, waistY + u * 0.4)} ${P(-skirtW * 0.92, hipY + u * 0.2)} ${P(-skirtW, skirtBottom)}
    C${P(-skirtW * 0.5, skirtBottom + u * 0.07)} ${P(skirtW * 0.5, skirtBottom + u * 0.07)} ${P(skirtW, skirtBottom)}
    C${P(skirtW * 0.92, hipY + u * 0.2)} ${P(sw * 0.98, waistY + u * 0.4)} ${P(sw * 0.56, waistY)} Z`;
  const folds = [-0.55, -0.2, 0.15, 0.5]
    .map((k) => `M${P(k * sw * 0.7, waistY + u * 0.25)} Q${P(k * skirtW * 0.7, (waistY + skirtBottom) / 2)} ${P(k * skirtW * 0.95, skirtBottom)}`)
    .join(" ");

  return (
    <g transform={`translate(${f.x} 0)`}>
      <ellipse cx={u * 0.15} cy={0} rx={f.bride ? skirtW * 1.1 : sw * 1.2} ry={u * 0.13} fill="url(#m-shadow)" />
      {woman && f.longHair && !f.bride && <path d={longBack} fill={f.hair} />}
      {woman && f.longHair && !f.bride && <path d={longBack} fill="url(#m-hair)" />}
      {f.bride && (
        <path d={`M${P(-R * 0.2, cy - ry * 0.75)} C${P(-R * 1.6, cy)} ${P(-sw * 1.5, waistY)} ${P(-sw * 1.65, hipY + u * 1.3)} L${P(sw * 1.65, hipY + u * 1.3)} C${P(sw * 1.5, waistY)} ${P(R * 1.6, cy)} ${P(R * 0.2, cy - ry * 0.75)} Z`} fill="#ffffff" opacity={0.25} />
      )}

      {woman ? (
        <>
          {!f.bride && (
            <>
              <path d={womanLeg(-1)} fill={f.skin} stroke={OL} strokeWidth={olw} />
              <path d={womanLeg(1)} fill={f.skin} stroke={OL} strokeWidth={olw} />
              <path d={womanLeg(-1)} fill="url(#m-cyl)" opacity={0.6} />
              <path d={womanLeg(1)} fill="url(#m-cyl)" opacity={0.6} />
              <path d={heel(-1)} fill="#1a1a1e" />
              <path d={heel(1)} fill="#1a1a1e" />
            </>
          )}
          <path d={neck} fill={f.skin} />
          <path d={neck} fill="url(#m-cyl)" opacity={0.6} />
          {arm(-1)}
          {arm(1)}
          <path d={shoulders} fill={f.skin} stroke={OL} strokeWidth={olw} />
          <path d={shoulders} fill="url(#m-shade)" opacity={0.6} />
          <path d={`M${P(-sw * 0.35, neckY + u * 0.1)} q${P(sw * 0.18, u * 0.06)} ${P(sw * 0.3, u * 0.02)} M${P(sw * 0.35, neckY + u * 0.1)} q${P(-sw * 0.18, u * 0.06)} ${P(-sw * 0.3, u * 0.02)}`} stroke={shade} strokeWidth={u * 0.018} fill="none" />
          <path d={skirt} fill={f.tone} stroke="rgba(60,40,30,0.35)" strokeWidth={olw} />
          <path d={skirt} fill="url(#m-satin)" />
          <path d={skirt} fill="url(#m-vert)" />
          <path d={folds} stroke="rgba(0,0,0,0.1)" strokeWidth={u * 0.03} fill="none" />
          <path d={bodice} fill={f.tone} stroke="rgba(60,40,30,0.35)" strokeWidth={olw} />
          {!f.bride && <path d={`M${P(-u * 0.17, bodiceTop)} L${P(0, bodiceTop + u * 0.45)} L${P(u * 0.17, bodiceTop)} Z`} fill={f.skin} />}
          <path d={bodice} fill="url(#m-shade)" />
          <path d={bodice} fill="url(#m-satin)" opacity={0.6} />
          {f.bride && (
            <>
              <path d={bodice} fill="url(#m-lace)" opacity={0.6} />
              <path d={skirt} fill="url(#m-lace)" opacity={0.35} />
              {/* sheer lace over shoulders and arms */}
              <path d={shoulders} fill="#ffffff" opacity={0.22} />
              <path d={shoulders} fill="url(#m-lace)" opacity={0.5} />
              <rect x={-sw * 0.57} y={waistY - u * 0.1} width={sw * 1.14} height={u * 0.12} rx={u * 0.04} fill="#e9dfcc" />
            </>
          )}
          {f.bride && (
            <g>
              <path d={`M${P(-u * 0.04, waistY + u * 0.2)} L${P(-u * 0.02, hipY + u * 0.25)} L${P(u * 0.02, hipY + u * 0.25)} L${P(u * 0.04, waistY + u * 0.2)} Z`} fill="#5f7f4a" />
              {([[-0.15, -0.02, "#ffffff"], [0.02, -0.11, "#f6d4dc"], [0.16, 0, "#ffffff"], [-0.06, 0.11, "#f2c6cf"], [0.1, 0.11, "#fff4e6"], [0, 0.02, "#e9a8b6"]] as const).map(([dx, dy, c], i) => (
                <circle key={i} cx={dx * u * 1.35} cy={waistY + u * 0.04 + dy * u * 1.35} r={u * 0.12} fill={c} />
              ))}
              <circle cx={-u * 0.28} cy={waistY + u * 0.15} r={u * 0.06} fill="#6f9a52" />
              <circle cx={u * 0.28} cy={waistY + u * 0.13} r={u * 0.06} fill="#6f9a52" />
            </g>
          )}
        </>
      ) : (
        <>
          <path d={leg(-1)} fill={f.tone} />
          <path d={leg(1)} fill={f.tone} />
          <path d={leg(-1)} fill="url(#m-cyl)" />
          <path d={leg(1)} fill="url(#m-cyl)" />
          <path d={shoe(-1)} fill="#141418" />
          <path d={shoe(1)} fill="#141418" />
          <path d={neck} fill={f.skin} />
          <path d={neck} fill="url(#m-cyl)" opacity={0.6} />
          <path d={jacket} fill={f.tone} stroke="rgba(0,0,0,0.6)" strokeWidth={olw} />
          {/* shirt, collar, tie, lapels */}
          <path d={`M${P(-u * 0.2, collarY)} L${P(0, vBottom)} L${P(u * 0.2, collarY)} Z`} fill="#f4f2ee" />
          <path d={`M${P(-u * 0.18, collarY - u * 0.03)} L${P(-u * 0.01, collarY + u * 0.16)} L${P(-u * 0.13, collarY + u * 0.22)} Z`} fill="#e2dfd9" />
          <path d={`M${P(u * 0.18, collarY - u * 0.03)} L${P(u * 0.01, collarY + u * 0.16)} L${P(u * 0.13, collarY + u * 0.22)} Z`} fill="#e2dfd9" />
          {f.groom ? (
            <g>
              <path d={`M${P(0, collarY + u * 0.16)} L${P(-u * 0.17, collarY + u * 0.08)} L${P(-u * 0.17, collarY + u * 0.26)} Z M${P(0, collarY + u * 0.16)} L${P(u * 0.17, collarY + u * 0.08)} L${P(u * 0.17, collarY + u * 0.26)} Z`} fill="#1c2233" stroke={OL} strokeWidth={olw * 0.6} />
              <circle cx={0} cy={collarY + u * 0.16} r={u * 0.04} fill="#141826" />
              {[0.36, 0.52, 0.68].map((k) => (
                <circle key={k} cx={0} cy={collarY + u * k} r={u * 0.016} fill="#c9c4bc" />
              ))}
            </g>
          ) : (
            <path d={`M${P(-u * 0.045, collarY + u * 0.14)} L${P(u * 0.045, collarY + u * 0.14)} L${P(u * 0.065, vBottom - u * 0.2)} L${P(0, vBottom - u * 0.08)} L${P(-u * 0.065, vBottom - u * 0.2)} Z`} fill={f.x < 0 ? "#3b3550" : "#5a2230"} />
          )}
          <path d={`M${P(-u * 0.2, collarY)} L${P(-u * 0.44, shY + u * 0.42)} L${P(-u * 0.32, shY + u * 0.48)} L${P(-u * 0.02, vBottom)} Z`} fill="rgba(0,0,0,0.2)" />
          <path d={`M${P(u * 0.2, collarY)} L${P(u * 0.44, shY + u * 0.42)} L${P(u * 0.32, shY + u * 0.48)} L${P(u * 0.02, vBottom)} Z`} fill="rgba(0,0,0,0.2)" />
          <circle cx={0} cy={vBottom + u * 0.12} r={u * 0.03} fill="rgba(0,0,0,0.45)" />
          <path d={`M${P(u * 0.42, shY + u * 0.72)} l${P(u * 0.1, -u * 0.09)} l${P(u * 0.08, u * 0.09)} z`} fill="#f2f0ec" />
          {f.groom && (
            <g>
              <circle cx={-u * 0.38} cy={shY + u * 0.4} r={u * 0.08} fill="#f2a7b5" stroke={OL} strokeWidth={olw * 0.6} />
              <circle cx={-u * 0.38} cy={shY + u * 0.4} r={u * 0.035} fill="#e07890" />
              <path d={`M${P(-u * 0.42, shY + u * 0.47)} l${P(-u * 0.05, u * 0.12)}`} stroke="#5f7f4a" strokeWidth={u * 0.025} />
            </g>
          )}
          <path d={jacket} fill="url(#m-shade)" />
          {arm(-1)}
          {arm(1)}
        </>
      )}

      {headDetails}
      {/* hair */}
      {woman && f.longHair && !f.bride ? (
        <path d={longFront} fill={f.hair} stroke={OL} strokeWidth={olw} />
      ) : woman ? (
        <>
          {/* smooth updo with a bun and a side-swept fringe */}
          <ellipse cx={R * 0.05} cy={cy - ry * 1.05} rx={R * 0.62} ry={ry * 0.32} fill={f.hair} stroke={OL} strokeWidth={olw} />
          <path d={updo} fill={f.hair} stroke={OL} strokeWidth={olw} />
          <path d={`M${P(-R * 0.9, cy - ry * 0.25)} C${P(-R * 0.7, cy - ry * 0.85)} ${P(R * 0.2, cy - ry * 0.95)} ${P(R * 0.6, cy - ry * 0.55)} C${P(R * 0.1, cy - ry * 0.68)} ${P(-R * 0.45, cy - ry * 0.5)} ${P(-R * 0.9, cy - ry * 0.25)} Z`} fill={f.hair} />
          <path d={`M${P(-R * 0.95, cy + ry * 0.0)} q${P(-R * 0.1, ry * 0.3)} ${P(R * 0.02, ry * 0.55)}`} stroke={f.hair} strokeWidth={u * 0.035} fill="none" strokeLinecap="round" />
          <path d={`M${P(-R * 0.5, cy - ry * 0.95)} Q${P(0, cy - ry * 1.15)} ${P(R * 0.5, cy - ry * 0.98)}`} stroke="rgba(255,255,255,0.3)" strokeWidth={u * 0.03} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* neat hair with a side parting and a soft swoop */}
          <path d={manHair} fill={f.hair} stroke={OL} strokeWidth={olw} />
          <path d={`M${P(-R * 0.55, cy - ry * 0.95)} C${P(-R * 0.3, cy - ry * 1.32)} ${P(R * 0.75, cy - ry * 1.28)} ${P(R * 1.0, cy - ry * 0.6)} C${P(R * 0.6, cy - ry * 0.9)} ${P(-R * 0.1, cy - ry * 0.95)} ${P(-R * 0.55, cy - ry * 0.95)} Z`} fill={f.hair} stroke={OL} strokeWidth={olw} />
          <path d={`M${P(-R * 0.42, cy - ry * 1.0)} Q${P(R * 0.2, cy - ry * 1.25)} ${P(R * 0.8, cy - ry * 0.75)}`} stroke="rgba(255,255,255,0.3)" strokeWidth={u * 0.025} fill="none" strokeLinecap="round" />
        </>
      )}
      <path d={woman && f.longHair && !f.bride ? longFront : woman ? updo : manHair} fill="url(#m-hair)" opacity={0.7} />
      {f.bride && (
        <>
          <path d={`M${P(-R * 0.72, cy - ry * 0.95)} L${P(-R * 0.5, cy - ry * 1.12)} L${P(-R * 0.3, cy - ry * 1.02)} L${P(0, cy - ry * 1.26)} L${P(R * 0.3, cy - ry * 1.02)} L${P(R * 0.5, cy - ry * 1.12)} L${P(R * 0.72, cy - ry * 0.95)}`} stroke="#e8e6ee" strokeWidth={u * 0.03} fill="none" strokeLinejoin="round" />
          {([[0.85, -0.85], [1.0, -0.6], [0.7, -0.62]] as const).map(([dx, dy], i) => (
            <g key={i}>
              <circle cx={R * dx} cy={cy + ry * dy} r={R * 0.12} fill="#ffffff" stroke={OL} strokeWidth={olw * 0.7} />
              <circle cx={R * dx} cy={cy + ry * dy} r={R * 0.04} fill="#f2c94c" />
            </g>
          ))}
          <circle cx={-R * 1.0} cy={eyeY + ry * 0.42} r={u * 0.03} fill="#f4f1ff" stroke="#b9b6c8" strokeWidth={olw * 0.6} />
          <circle cx={R * 1.0} cy={eyeY + ry * 0.42} r={u * 0.03} fill="#f4f1ff" stroke="#b9b6c8" strokeWidth={olw * 0.6} />
          <path d={`M${P(-nw * 1.6, neckY + u * 0.02)} Q${P(0, neckY + u * 0.28)} ${P(nw * 1.6, neckY + u * 0.02)}`} stroke="#eceaf2" strokeWidth={u * 0.012} fill="none" />
          <path d={`M${P(-sw * 0.5, bustY - u * 0.12)} L${P(-sw * 0.55, neckY + u * 0.08)} M${P(sw * 0.5, bustY - u * 0.12)} L${P(sw * 0.55, neckY + u * 0.08)}`} stroke="#f4efe7" strokeWidth={u * 0.02} />
          <path d={`M${P(R * 0.2, cy - ry * 0.85)} C${P(R * 1.9, cy)} ${P(R * 2.1, shY + u * 2)} ${P(R * 1.4, waistY + u * 0.8)} L${P(R * 0.9, shY)} Z`} fill="#ffffff" opacity={0.14} />
        </>
      )}
    </g>
  );
}

/** Animated two-channel audio level meter, drawn in the left edge of the screen. */
function AudioMeter({ m, H }: { m: MeterInput; H: number }) {
  const [lv, setLv] = useState({ a: m.avg, b: m.avg, pa: m.avg, pb: m.avg });
  const ref = useRef(m);
  ref.current = m;
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let state = { a: m.avg, b: m.avg, pa: m.avg, pb: m.avg, ta: 0, tb: 0 };
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 60) return;
      last = now;
      const { avg, peak, stereo } = ref.current;
      const swing = Math.max(peak - avg, 3);
      const next = (v: number) => {
        const target = reduce ? avg : avg - 6 + Math.random() * (swing + 6);
        return v + (Math.min(target, peak) - v) * 0.5;
      };
      const a = next(state.a);
      const b = stereo === false ? a : next(state.b) - 0.5; // mono: both channels identical
      const hold = (p: number, v: number, t: number) => (v >= p ? [v, now] : now - t > 900 ? [p - 1.5, t] : [p, t]);
      const [pa, ta] = hold(state.pa, a, state.ta);
      const [pb, tb] = hold(state.pb, b, state.tb);
      state = { a, b, pa, pb, ta, tb };
      setLv({ a, b, pa, pb });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Horizontal, segmented meter in the lower left corner, like a camera's audio level display.
  const x0 = 14;
  const len = 120;
  const segs = 36;
  const segW = len / segs;
  const pos = (db: number) => ((Math.min(0, Math.max(-48, db)) + 48) / 48) * len;
  const yA = H - 33;
  const yB = H - 26;
  const segColor = (i: number) => {
    const db = -48 + ((i + 0.5) / segs) * 48;
    return db > -6 ? "#ff4d47" : db > -12 ? "#ffd34d" : "#36d17a";
  };
  const row = (y: number, v: number, pk: number, ch: string) => (
    <g>
      <text x={x0 - 7} y={y + 3.6}>{ch}</text>
      {Array.from({ length: segs }, (_, i) => {
        const lit = (i + 1) * segW <= pos(v);
        return (
          <rect key={i} x={x0 + i * segW} y={y} width={segW - 0.8} height={4.2} rx={0.4} fill={lit ? segColor(i) : "#ffffff"} opacity={lit ? 1 : 0.16} />
        );
      })}
      <rect x={x0 + pos(pk) - 0.8} y={y - 0.6} width={1.4} height={5.4} fill="#fff" />
    </g>
  );
  return (
    <g className="hud" fontSize={5}>
      <rect x={x0 - 10} y={yA - 9} width={len + 16} height={23} rx={2} fill="#000" opacity={0.4} />
      {[-40, -20, -12, -6, 0].map((d) => (
        <text key={d} x={x0 + pos(d)} y={yA - 2.5} textAnchor="middle" opacity={0.85}>{d}</text>
      ))}
      {row(yA, lv.a, lv.pa, "1")}
      {row(yB, lv.b, lv.pb, "2")}
      {m.clip && <text x={x0 + len + 3} y={yB + 4} fill="#ff4d47">CLIP</text>}
      {!m.clip && m.limiting && <text x={x0 + len + 3} y={yB + 4} fill="#ffd34d">LIM</text>}
    </g>
  );
}

export default function Monitor(p: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const P = p.palette;
  const H = Math.round(W / p.aspect);
  const isVideo = p.mode === "video";
  const vfov = 2 * Math.atan(p.frameHeightMM / 2 / p.focal);
  const frameH = (d: number) => 2 * d * Math.tan(vfov / 2);
  const scale = (d: number) => H / frameH(d);
  const halfW = (d: number) => (frameH(d) * (W / H)) / 2;
  const layer = (d: number) => `translate(${W / 2} ${H / 2}) scale(${scale(d)})`;

  const sMM = p.focusM * 1000;
  const blur = (d: number) => {
    const b = blurDisc(p.focal, p.aperture, sMM, d * 1000);
    if (b <= p.cocMM) return 0;
    return Math.min((b / p.frameHeightMM) * H, 90);
  };
  const sd = (d: number) => blur(d) / 2.5;

  const d = p.focusM;
  const lightsD = d + 2;
  const backD = d + 4.5;
  const hillsD = 120;
  const photoD = d + 15; // background photos: the venue about 15 m behind the subject
  // photos are framed like a ~28 mm (full-frame) shot; longer lenses crop into them
  const refHalfV = Math.atan(10.125 / 28);
  const photoZoom = Math.max(1, Math.tan(refHalfV) / Math.tan(vfov / 2));
  const branchD = Math.max(d * 0.4, 0.35);

  const gain = Math.pow(2, p.exposureDelta);
  const slope = p.cast.map((c) => (c * gain) / (p.logView ? 8 : 1));
  const logTable = Array.from({ length: 65 }, (_, i) => {
    const L = (i / 64) * 8;
    return L <= 0 ? 0.03 : Math.min(1, Math.max(0.03, (Math.log2(L) + 6) / 9));
  }).join(" ");

  // picture profile / LUT: contrast around mid grey, raised blacks, warm and teal-orange tint
  const lookIntercept = 0.5 * (1 - p.look.contrast) + (p.look.lift ?? 0);
  const w = p.look.warm ?? 0;
  const tl = p.look.teal ?? 0;
  const lookTint =
    w || tl
      ? [
          1 + w + 0.06 * tl, 0, 0, 0, 0,
          0, 1 - 0.02 * tl, 0.03 * tl, 0, 0,
          -0.04 * tl, 0, 1 - w + 0.05 * tl, 0, 0,
          0, 0, 0, 1, 0,
        ].join(" ")
      : "";

  // background elements across the frame
  const backHalf = halfW(backD) + 2;
  const backItems: number[] = [];
  const backStep = P.indoor ? 0.9 : 1.8;
  for (let x = -backHalf; x <= backHalf && backItems.length < 80; x += backStep) backItems.push(x);

  const lightsHalf = halfW(lightsD) + 0.5;
  const lStep = Math.max(0.35, lightsHalf / 30);
  const lights: { x: number; y: number }[] = [];
  for (let x = -lightsHalf; x <= lightsHalf && lights.length < 180; x += lStep)
    lights.push({ x, y: -0.75 + 0.25 * Math.cos((x / 2.8) * Math.PI) });
  const lScale = scale(lightsD);
  const lBlur = blur(lightsD);

  const subjRows = rows(p.subject);
  const figs = subjRows[0].figures;
  const tallest = Math.max(...figs.map((f) => f.h));
  const groupHalf = Math.max(...figs.map((f) => Math.abs(f.x))) + 0.3;
  const af = {
    x: W / 2 - groupHalf * scale(d),
    y: H / 2 + (EYE - tallest) * scale(d) - 6,
    w: groupHalf * 2 * scale(d),
    h: tallest * 0.22 * scale(d) + 10,
  };
  const meter = Math.max(-3, Math.min(3, p.exposureDelta));
  const { meter: _m, ...scanProps } = p;
  useScopes(svgRef, canvasRef, p.assist, H, JSON.stringify(scanProps));
  const zebraTables = p.assist.zebras.map((z) =>
    Array.from({ length: 201 }, (_, i) => (i / 200 >= z.lo && i / 200 <= z.hi ? 1 : 0)).join(" ")
  );
  const box = (r: number) => ({ w: r < W / H ? H * r : W, h: r > W / H ? W / r : H });
  const g = p.assist.frames[0]?.ratio ?? 0;
  const { w: guideW, h: guideH } = box(g || W / H);

  return (
    <figure className="monitor">
      <div className="monitor-bezel">
        <div className="monitor-stack">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.label} className="monitor-screen">
          <defs>
            <clipPath id="m-frame"><rect width={W} height={H} /></clipPath>
            <linearGradient id="m-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={P.skyTop} />
              <stop offset="100%" stopColor={P.skyBottom} />
            </linearGradient>
            <linearGradient id="m-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={P.groundTop} />
              <stop offset="100%" stopColor={P.groundBottom} />
            </linearGradient>
            {/* light comes from the upper left: rounded forms get a lit side, a core shadow and a reflected edge */}
            <linearGradient id="m-shade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.2" />
              <stop offset="16%" stopColor="#ffffff" stopOpacity="0.16" />
              <stop offset="48%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="88%" stopColor="#000000" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="m-cyl" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.28" />
              <stop offset="22%" stopColor="#ffffff" stopOpacity="0.16" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="85%" stopColor="#000000" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="m-vert" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="45%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="m-hair" x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.15" />
              <stop offset="22%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="34%" stopColor="#ffffff" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="m-satin" x1="0" y1="0" x2="1" y2="0.3">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="30%" stopColor="#ffffff" stopOpacity="0.28" />
              <stop offset="42%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="70%" stopColor="#000000" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
            </linearGradient>
            <radialGradient id="m-face" cx="0.36" cy="0.38" r="0.78">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.04" />
              <stop offset="78%" stopColor="#000000" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
            </radialGradient>
            <pattern id="m-lace" width="0.022" height="0.022" patternUnits="userSpaceOnUse">
              <circle cx="0.011" cy="0.011" r="0.0045" fill="none" stroke="#ffffff" strokeWidth="0.0015" opacity="0.75" />
              <circle cx="0" cy="0" r="0.002" fill="#ffffff" opacity="0.6" />
              <circle cx="0.022" cy="0.022" r="0.002" fill="#ffffff" opacity="0.6" />
            </pattern>
            <radialGradient id="m-shadow">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#000000" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="m-lips" cx="0.5" cy="0.35" r="0.7">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
            </radialGradient>
            <linearGradient id="m-fold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.18" />
              <stop offset="25%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#000000" stopOpacity="0.08" />
              <stop offset="75%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="m-cpl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d3f8a" />
              <stop offset="100%" stopColor="#7d9ad0" stopOpacity="0.2" />
            </linearGradient>
            {P.lights.map((c, i) => (
              <radialGradient key={i} id={`m-bokeh-${i}`}>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="45%" stopColor={c} stopOpacity="0.95" />
                <stop offset="100%" stopColor={c} stopOpacity="0.55" />
              </radialGradient>
            ))}
            {([
              ["m-b-hills", sd(hillsD)],
              ["m-b-back", sd(backD)],
              ["m-b-photo", sd(photoD)],
              ...subjRows.map((row, i): [string, number] => [`m-b-row-${i}`, sd(d + row.offset)]),
              ["m-b-branch", sd(branchD)],
            ] as [string, number][]).map(([id, s]) => (
              <filter key={id} id={id} filterUnits="userSpaceOnUse" x={-100} y={-100} width={W + 200} height={H + 200}>
                <feGaussianBlur stdDeviation={s} />
              </filter>
            ))}
            <filter id="m-expose" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <feColorMatrix type="saturate" values={String(1 + (P.indoor ? 0.05 : 0.35) * p.cpl)} />
              <feComponentTransfer>
                <feFuncR type="gamma" amplitude={1} exponent={2.2} offset={0} />
                <feFuncG type="gamma" amplitude={1} exponent={2.2} offset={0} />
                <feFuncB type="gamma" amplitude={1} exponent={2.2} offset={0} />
              </feComponentTransfer>
              <feComponentTransfer>
                <feFuncR type="linear" slope={slope[0]} intercept={0} />
                <feFuncG type="linear" slope={slope[1]} intercept={0} />
                <feFuncB type="linear" slope={slope[2]} intercept={0} />
              </feComponentTransfer>
              {p.logView ? (
                <>
                  <feComponentTransfer>
                    <feFuncR type="table" tableValues={logTable} />
                    <feFuncG type="table" tableValues={logTable} />
                    <feFuncB type="table" tableValues={logTable} />
                  </feComponentTransfer>
                  <feColorMatrix type="saturate" values="0.6" />
                </>
              ) : (
                <>
                  <feComponentTransfer>
                    <feFuncR type="gamma" amplitude={1} exponent={1 / 2.2} offset={0} />
                    <feFuncG type="gamma" amplitude={1} exponent={1 / 2.2} offset={0} />
                    <feFuncB type="gamma" amplitude={1} exponent={1 / 2.2} offset={0} />
                  </feComponentTransfer>
                  <feColorMatrix type="saturate" values={String(p.look.sat)} />
                  <feComponentTransfer>
                    <feFuncR type="linear" slope={p.look.contrast} intercept={lookIntercept} />
                    <feFuncG type="linear" slope={p.look.contrast} intercept={lookIntercept} />
                    <feFuncB type="linear" slope={p.look.contrast} intercept={lookIntercept} />
                  </feComponentTransfer>
                  {lookTint && <feColorMatrix type="matrix" values={lookTint} />}
                </>
              )}
              {(p.assist.falseColor || p.assist.zebras.length > 0) && (
                <feComponentTransfer data-assist="" result="base" />
              )}
              {p.assist.falseColor && (
                <>
                  <feColorMatrix data-assist="" in="base" type="matrix" values={LUMA_RGB} />
                  <feComponentTransfer data-assist="" result="disp">
                    <feFuncR type="table" tableValues={fcTables[0]} />
                    <feFuncG type="table" tableValues={fcTables[1]} />
                    <feFuncB type="table" tableValues={fcTables[2]} />
                  </feComponentTransfer>
                </>
              )}
              {p.assist.zebras.map((z, i) => (
                <Fragment key={i}>
                  <feColorMatrix data-assist="" in="base" type="matrix" values={LUMA_ALPHA} />
                  <feComponentTransfer data-assist="" result={`zmask${i}`}>
                    <feFuncA type="discrete" tableValues={zebraTables[i]} />
                  </feComponentTransfer>
                  <feImage data-assist="" href={ZEBRA_TILES[z.dir]} x={0} y={0} width={6} height={6} result={`ztile${i}`} />
                  <feTile data-assist="" in={`ztile${i}`} result={`zstripes${i}`} />
                  <feComposite data-assist="" in={`zstripes${i}`} in2={`zmask${i}`} operator="in" result={`zebra${i}`} />
                </Fragment>
              ))}
              {p.assist.zebras.length > 0 && (
                <feMerge data-assist="">
                  <feMergeNode in={p.assist.falseColor ? "disp" : "base"} />
                  {p.assist.zebras.map((_, i) => (
                    <feMergeNode key={i} in={`zebra${i}`} />
                  ))}
                </feMerge>
              )}
            </filter>
            <filter id="m-grain" filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <feTurbulence type="fractalNoise" baseFrequency={1.5} numOctaves={1} seed={7} />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>

          <g clipPath="url(#m-frame)">
            <rect width={W} height={H} fill="#000" />
            <g transform={p.skew ? `translate(${W / 2} ${H / 2}) skewX(${p.skew}) scale(1.04) translate(${-W / 2} ${-H / 2})` : undefined}>
            <g filter="url(#m-expose)">
              <rect width={W} height={H / 2 + 1} fill="url(#m-sky)" />
              <rect y={H / 2} width={W} height={H / 2} fill="url(#m-ground)" />
              {!P.indoor && p.cpl > 0 && (
                <rect width={W} height={H / 2} fill="url(#m-cpl)" opacity={p.cpl * 0.55} style={{ mixBlendMode: "multiply" }} />
              )}

              {p.photo && (
                <g filter="url(#m-b-photo)">
                  <image
                    href={p.photo}
                    x={W / 2 - (W * photoZoom) / 2}
                    y={H / 2 - (H * photoZoom) / 2}
                    width={W * photoZoom}
                    height={H * photoZoom}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </g>
              )}
              {!p.photo && !P.indoor && p.backdrop !== "sea" && (
                <g filter="url(#m-b-hills)">
                  <path
                    d={`M0 ${H / 2 + 1} L0 ${H / 2 - 12} Q70 ${H / 2 - 28} 140 ${H / 2 - 14} T260 ${H / 2 - 18} T320 ${H / 2 - 10} L320 ${H / 2 + 1} Z`}
                    fill={P.hills}
                    opacity={p.uv ? 0.92 : 0.78}
                  />
                </g>
              )}

              {p.backdrop === "sea" && (
                <g filter="url(#m-b-hills)">
                  <rect x={0} y={H / 2 - 1} width={W} height={H * 0.09} fill={P.hills} />
                  <rect x={0} y={H / 2 - 1} width={W} height={2} fill="#ffffff" opacity={0.35} />
                </g>
              )}
              <g filter="url(#m-b-back)">
                <g transform={layer(backD)}>
                  {p.photo ? null : p.backdrop === "buildings" ? (
                    backItems.map((x, i) => {
                      const h = 6 + ((i * 37) % 9);
                      const w = 1.7;
                      return (
                        <g key={i}>
                          <rect x={x} y={EYE - h} width={w} height={h} fill={P.trees[i % 3]} />
                          {Array.from({ length: Math.floor(h / 1.1) }, (_, k) => (
                            <g key={k}>
                              <rect x={x + 0.25} y={EYE - h + 0.5 + k * 1.1} width={0.45} height={0.55} fill="#3d4a5a" opacity={0.75} />
                              <rect x={x + 1.0} y={EYE - h + 0.5 + k * 1.1} width={0.45} height={0.55} fill="#3d4a5a" opacity={0.75} />
                            </g>
                          ))}
                        </g>
                      );
                    })
                  ) : p.backdrop === "sea" ? null : backItems.map((x, i) =>
                    P.indoor ? (
                      <rect key={i} x={x} y={EYE - 7} width={0.88} height={7} fill={P.trees[i % 3]} />
                    ) : (
                      <g key={i} transform={`translate(${x} ${EYE})`}>
                        <rect x={-0.13} y={-1.6} width={0.26} height={1.6} fill={P.trunk} />
                        <ellipse cx={0} cy={-2.9 - (i % 3) * 0.3} rx={1 + (i % 3) * 0.15} ry={1.6 + (i % 2) * 0.3} fill={P.trees[i % 3]} />
                      </g>
                    )
                  )}
                </g>
              </g>

              {!p.photo && lights.map((l, i) => {
                const cx = W / 2 + l.x * lScale;
                const cy = H / 2 + l.y * lScale;
                const sharpR = Math.max(0.03 * lScale, 0.6);
                const r = Math.max(sharpR, lBlur / 2);
                const op = Math.max(0.25, Math.min(1, (sharpR / r) * 2.2)) * P.lightsOpacity;
                return <circle key={i} cx={cx} cy={cy} r={r} fill={`url(#m-bokeh-${i % P.lights.length})`} opacity={op} />;
              })}

              {[...subjRows].reverse().map((row) => {
                const i = subjRows.indexOf(row);
                return (
                  <g key={i} filter={`url(#m-b-row-${i})`}>
                    <g transform={layer(d + row.offset)}>
                      <g transform={`translate(0 ${EYE})`}>
                        {p.illu && p.subject === "couple" ? (
                          <IlluPerson pic={p.illu.couple} x={0} heightM={1.84} />
                        ) : p.illu && p.subject === "person" ? (
                          <IlluPerson pic={p.illu.groom} x={0} heightM={1.82} />
                        ) : p.illu ? (
                          row.figures.map((f, j) => {
                            const pool = f.dress ? p.illu!.women : p.illu!.men;
                            return <IlluPerson key={j} pic={pool[(j + i * 3) % pool.length]} x={f.x} heightM={f.h + (f.dress ? 0.04 : 0.02)} flip={j % 4 >= 2} />;
                          })
                        ) : (
                          row.figures.map((f, j) => <FigureShape key={j} f={f} />)
                        )}
                      </g>
                    </g>
                  </g>
                );
              })}

              <g filter="url(#m-b-branch)">
                <g transform={layer(branchD)}>
                  <g transform={`translate(${-halfW(branchD)} ${-frameH(branchD) * 0.2}) scale(${frameH(branchD) / 1.5})`}>
                    <path d="M-0.1 0.45 Q0.2 0.25 0.4 0.1" stroke={P.indoor ? "#7a6a52" : "#3b2f22"} strokeWidth={0.03} fill="none" />
                    {[0, 1, 2, 3, 4].map((i) => (
                      <ellipse
                        key={i}
                        cx={0.05 + i * 0.08}
                        cy={0.38 - i * 0.065}
                        rx={0.085}
                        ry={0.038}
                        transform={`rotate(${-30 + i * 9} ${0.05 + i * 0.08} ${0.38 - i * 0.065})`}
                        fill={P.leaves[i % 2]}
                      />
                    ))}
                  </g>
                </g>
              </g>
            </g>

            </g>

            {p.grain > 0.01 && (
              <rect width={W} height={H} filter="url(#m-grain)" opacity={p.grain} style={{ mixBlendMode: "overlay" }} />
            )}

            {g > 0 && (
              <g data-noscan="">
                {guideW < W && (
                  <>
                    <rect width={(W - guideW) / 2} height={H} fill="#000" opacity={p.assist.frameMask} />
                    <rect x={(W + guideW) / 2} width={(W - guideW) / 2} height={H} fill="#000" opacity={p.assist.frameMask} />
                  </>
                )}
                {guideH < H && (
                  <>
                    <rect width={W} height={(H - guideH) / 2} fill="#000" opacity={p.assist.frameMask} />
                    <rect y={(H + guideH) / 2} width={W} height={(H - guideH) / 2} fill="#000" opacity={p.assist.frameMask} />
                  </>
                )}
                {p.assist.frames.map((f, i) => {
                  const b = box(f.ratio);
                  return (
                    <rect key={i} x={(W - b.w) / 2} y={(H - b.h) / 2} width={b.w} height={b.h} fill="none" stroke={f.color} strokeOpacity={0.9} strokeWidth={0.8} />
                  );
                })}
              </g>
            )}

            <g data-noscan="" stroke="#fff" strokeOpacity={0.22} strokeWidth={0.4}>
              <line x1={W / 3} y1={0} x2={W / 3} y2={H} />
              <line x1={(2 * W) / 3} y1={0} x2={(2 * W) / 3} y2={H} />
              <line x1={0} y1={H / 3} x2={W} y2={H / 3} />
              <line x1={0} y1={(2 * H) / 3} x2={W} y2={(2 * H) / 3} />
            </g>

            {af.w < W * 1.2 && (
              <g data-noscan="" stroke="#3ee07a" strokeWidth={1} fill="none">
                <path d={`M${af.x} ${af.y + 6} v-6 h6 M${af.x + af.w - 6} ${af.y} h6 v6 M${af.x + af.w} ${af.y + af.h - 6} v6 h-6 M${af.x + 6} ${af.y + af.h} h-6 v-6`} />
              </g>
            )}

            {isVideo && p.meter && <g data-noscan=""><AudioMeter m={p.meter} H={H} /></g>}

            <g data-noscan="" className="hud" fontSize={7}>
              {isVideo ? (
                <>
                  <circle cx={10} cy={10} r={3} fill="#ff3b3b" />
                  <text x={16} y={12.5}>REC</text>
                  <text x={38} y={12.5} opacity={0.85}>{p.hud.fps}</text>
                </>
              ) : (
                <text x={6} y={12.5} opacity={0.85}>{p.hud.fps}</text>
              )}
              {p.hud.profile && <text x={W - 6} y={12.5} textAnchor="end" fill="#ffcf6b">{p.hud.profile}</text>}
              {p.hud.filters && <text x={W - 6} y={22} textAnchor="end" fill="#9fd8ff">{p.hud.filters}</text>}
              <rect y={H - 15} width={W} height={15} fill="#000" opacity={0.55} />
              <text x={6} y={H - 5}>{p.hud.shutter}  F{p.aperture.toFixed(1)}  ISO {p.hud.iso}  {p.hud.wb}</text>
              <g transform={`translate(${W / 2 + 46} ${H - 8})`}>
                {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
                  <line key={v} x1={v * 6} y1={v === 0 ? -4 : -2.5} x2={v * 6} y2={0} stroke="#fff" strokeWidth={0.6} />
                ))}
                <line x1={-18} y1={0} x2={18} y2={0} stroke="#fff" strokeWidth={0.5} />
                <path d={`M${meter * 6} 1 l-2 3 h4 z`} fill={Math.abs(p.exposureDelta) > 3 ? "#ff5a5a" : "#ffd34d"} />
              </g>
              <text x={W - 6} y={H - 5} textAnchor="end">AF {p.hud.focus}</text>
              {Math.abs(p.exposureDelta) >= 0.15 && (
                <text x={W - 6} y={p.hud.filters ? 31.5 : 22} textAnchor="end" fill={Math.abs(p.exposureDelta) > 3 ? "#ff7a7a" : "#fff"}>
                  {p.exposureDelta > 0 ? "+" : ""}
                  {p.exposureDelta.toFixed(1)} EV
                </text>
              )}
            </g>
          </g>
        </svg>
        <canvas ref={canvasRef} className="monitor-scopes" width={W * 2} height={Math.round(H * 2)} aria-hidden="true" />
        </div>
      </div>
    </figure>
  );
}
