import { Fragment, useEffect, useRef, useState } from "react";
import type { ScenePalette, BackdropKind } from "./lighting";
import { blurDisc } from "./optics";
import type { Look } from "./looks";

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
  tone: string; // suit or dress colour
  skin: string;
  hair: string;
  longHair?: boolean;
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
          person(1, -0.27, false, { tone: "#1d2027", h: 1.82, skin: "#d9a582", hair: "#1a1310" }),
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

export type MeterInput = { avg: number; peak: number; clip: boolean; limiting: boolean };

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

/** Rasterises the picture (without overlays) and draws waveform, histogram and focus peaking. */
function useScopes(svgRef: React.RefObject<SVGSVGElement>, canvasRef: React.RefObject<HTMLCanvasElement>, a: Assist, H: number, key: string) {
  const on = a.wfm !== "off" || a.histogram || a.peaking;
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
  }, [key, on, a.peaking, a.wfm, a.histogram, H, svgRef, canvasRef]);
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

/** A standing figure, feet at y = 0, drawn upward (negative y). Proportions use an 8-head canon. */
function FigureShape({ f }: { f: Figure }) {
  const u = f.h / 8; // head height
  const top = -f.h;
  const headCY = top + u * 0.52;
  const headRX = u * 0.34;
  const headRY = u * 0.46;
  const shoulderY = top + u * 1.38;
  const waistY = top + u * 3.05;
  const hipY = top + u * 4;
  const sw = f.dress ? u * 0.78 : u * 0.98; // half shoulder width
  const dark = "#111318";

  const torso = f.dress
    ? `M${-sw * 0.45} ${shoulderY - u * 0.02} C${-sw * 0.9} ${shoulderY} ${-sw} ${shoulderY + u * 0.2} ${-sw * 0.92} ${shoulderY + u * 0.55}
       C${-sw * 0.8} ${shoulderY + u * 1.1} ${-sw * 0.55} ${waistY - u * 0.3} ${-sw * 0.52} ${waistY}
       L${sw * 0.52} ${waistY} C${sw * 0.55} ${waistY - u * 0.3} ${sw * 0.8} ${shoulderY + u * 1.1} ${sw * 0.92} ${shoulderY + u * 0.55}
       C${sw} ${shoulderY + u * 0.2} ${sw * 0.9} ${shoulderY} ${sw * 0.45} ${shoulderY - u * 0.02} Z`
    : `M${-sw * 0.32} ${shoulderY - u * 0.06} C${-sw * 0.85} ${shoulderY - u * 0.04} ${-sw} ${shoulderY + u * 0.12} ${-sw} ${shoulderY + u * 0.5}
       L${-sw * 0.84} ${waistY} L${-sw * 0.8} ${hipY + u * 0.15} L${sw * 0.8} ${hipY + u * 0.15} L${sw * 0.84} ${waistY}
       L${sw} ${shoulderY + u * 0.5} C${sw} ${shoulderY + u * 0.12} ${sw * 0.85} ${shoulderY - u * 0.04} ${sw * 0.32} ${shoulderY - u * 0.06} Z`;

  const skirtBottom = f.bride ? 0 : -u * 1.25;
  const skirtW = f.bride ? u * 1.25 : u * 0.8;
  const skirt = `M${-sw * 0.52} ${waistY} C${-sw * 0.7} ${hipY} ${-skirtW * 0.9} ${(hipY + skirtBottom) / 2} ${-skirtW} ${skirtBottom}
    Q0 ${skirtBottom + u * 0.12} ${skirtW} ${skirtBottom} C${skirtW * 0.9} ${(hipY + skirtBottom) / 2} ${sw * 0.7} ${hipY} ${sw * 0.52} ${waistY} Z`;

  const arm = (side: 1 | -1, fill: string) => {
    const x0 = side * sw * 0.9;
    const elbowY = waistY - u * 0.1;
    const handY = hipY + u * 0.2;
    return (
      <g>
        <path
          d={`M${x0} ${shoulderY + u * 0.3} C${x0 + side * u * 0.22} ${shoulderY + u * 0.9} ${x0 + side * u * 0.14} ${elbowY} ${x0 + side * u * 0.02} ${handY - u * 0.15}`}
          stroke={fill}
          strokeWidth={u * (f.dress ? 0.2 : 0.3)}
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx={x0 + side * u * 0.02} cy={handY} rx={u * 0.11} ry={u * 0.15} fill={f.skin} />
      </g>
    );
  };

  return (
    <g transform={`translate(${f.x} 0)`}>
      {/* long hair falls behind the shoulders */}
      {f.longHair && (
        <path
          d={`M${-headRX * 1.1} ${headCY - headRY * 0.2} C${-headRX * 1.35} ${shoulderY + u * 0.4} ${-headRX * 0.9} ${shoulderY + u * 0.9} ${-headRX * 0.2} ${shoulderY + u * 0.85}
              L${headRX * 0.2} ${shoulderY + u * 0.85} C${headRX * 0.9} ${shoulderY + u * 0.9} ${headRX * 1.35} ${shoulderY + u * 0.4} ${headRX * 1.1} ${headCY - headRY * 0.2} Z`}
          fill={f.hair}
        />
      )}

      {/* legs */}
      {f.dress ? (
        !f.bride && (
          <>
            <rect x={-u * 0.22} y={skirtBottom - u * 0.1} width={u * 0.16} height={-skirtBottom + u * 0.05} rx={u * 0.08} fill={f.skin} />
            <rect x={u * 0.06} y={skirtBottom - u * 0.1} width={u * 0.16} height={-skirtBottom + u * 0.05} rx={u * 0.08} fill={f.skin} />
            <ellipse cx={-u * 0.16} cy={-u * 0.04} rx={u * 0.16} ry={u * 0.06} fill={dark} />
            <ellipse cx={u * 0.14} cy={-u * 0.04} rx={u * 0.16} ry={u * 0.06} fill={dark} />
          </>
        )
      ) : (
        <>
          <path d={`M${-sw * 0.78} ${hipY} L${-u * 0.06} ${hipY} L${-u * 0.1} ${-u * 0.08} L${-sw * 0.62} ${-u * 0.08} Z`} fill={f.tone} />
          <path d={`M${sw * 0.78} ${hipY} L${u * 0.06} ${hipY} L${u * 0.1} ${-u * 0.08} L${sw * 0.62} ${-u * 0.08} Z`} fill={f.tone} />
          <path d={`M${-sw * 0.66} ${-u * 0.1} h${sw * 0.62} q${u * 0.08} ${u * 0.1} 0 ${u * 0.1} h${-sw * 0.66} z`} fill={dark} />
          <path d={`M${sw * 0.66} ${-u * 0.1} h${-sw * 0.62} q${-u * 0.08} ${u * 0.1} 0 ${u * 0.1} h${sw * 0.66} z`} fill={dark} />
        </>
      )}

      {/* arms behind the body */}
      {arm(-1, f.dress ? f.skin : f.tone)}
      {arm(1, f.dress ? f.skin : f.tone)}

      {/* skirt / gown */}
      {f.dress && <path d={skirt} fill={f.tone} />}
      {f.dress && <path d={skirt} fill="url(#m-fold)" opacity={f.bride ? 0.55 : 0.35} />}

      {/* neck */}
      <path d={`M${-u * 0.13} ${headCY + headRY * 0.6} L${-u * 0.15} ${shoulderY + u * 0.05} L${u * 0.15} ${shoulderY + u * 0.05} L${u * 0.13} ${headCY + headRY * 0.6} Z`} fill={f.skin} />

      {/* torso */}
      <path d={torso} fill={f.tone} />
      {!f.dress && (
        <>
          <path d={`M${-u * 0.2} ${shoulderY - u * 0.04} L0 ${shoulderY + u * 1.05} L${u * 0.2} ${shoulderY - u * 0.04} Z`} fill="#f5f3ef" />
          <path d={`M${-u * 0.045} ${shoulderY + u * 0.08} L${u * 0.045} ${shoulderY + u * 0.08} L${u * 0.06} ${shoulderY + u * 0.85} L0 ${shoulderY + u * 0.98} L${-u * 0.06} ${shoulderY + u * 0.85} Z`} fill={f.x < 0 ? "#3b3550" : "#5a2230"} />
          <path d={`M${-u * 0.2} ${shoulderY - u * 0.04} L${-u * 0.42} ${shoulderY + u * 0.5} L${-u * 0.04} ${shoulderY + u * 1.2}`} stroke="rgba(255,255,255,0.14)" strokeWidth={u * 0.05} fill="none" />
          <path d={`M${u * 0.2} ${shoulderY - u * 0.04} L${u * 0.42} ${shoulderY + u * 0.5} L${u * 0.04} ${shoulderY + u * 1.2}`} stroke="rgba(255,255,255,0.14)" strokeWidth={u * 0.05} fill="none" />
        </>
      )}
      {f.dress && (
        <path d={`M${-sw * 0.45} ${shoulderY - u * 0.02} Q0 ${shoulderY + u * 0.35} ${sw * 0.45} ${shoulderY - u * 0.02}`} fill={f.skin} />
      )}
      <path d={torso} fill="url(#m-shade)" />

      {/* head */}
      <ellipse cx={0} cy={headCY} rx={headRX} ry={headRY} fill={f.skin} />
      <ellipse cx={-headRX * 0.08} cy={headCY} rx={headRX} ry={headRY} fill="url(#m-face)" />
      {/* hair */}
      {f.longHair ? (
        <path
          d={`M${-headRX * 1.06} ${headCY + headRY * 0.15} C${-headRX * 1.15} ${headCY - headRY * 1.25} ${headRX * 1.15} ${headCY - headRY * 1.25} ${headRX * 1.06} ${headCY + headRY * 0.15}
              C${headRX * 0.85} ${headCY - headRY * 0.55} ${-headRX * 0.3} ${headCY - headRY * 0.75} ${-headRX * 1.06} ${headCY + headRY * 0.15} Z`}
          fill={f.hair}
        />
      ) : f.dress ? (
        <>
          <circle cx={headRX * 0.15} cy={headCY - headRY * 1.05} r={headRX * 0.45} fill={f.hair} />
          <path d={`M${-headRX * 1.02} ${headCY} C${-headRX * 1.1} ${headCY - headRY * 1.2} ${headRX * 1.1} ${headCY - headRY * 1.2} ${headRX * 1.02} ${headCY} C${headRX * 0.7} ${headCY - headRY * 0.6} ${-headRX * 0.7} ${headCY - headRY * 0.6} ${-headRX * 1.02} ${headCY} Z`} fill={f.hair} />
        </>
      ) : (
        <path
          d={`M${-headRX * 1.03} ${headCY - headRY * 0.05} C${-headRX * 1.12} ${headCY - headRY * 1.22} ${headRX * 1.12} ${headCY - headRY * 1.22} ${headRX * 1.03} ${headCY - headRY * 0.05}
              C${headRX * 0.9} ${headCY - headRY * 0.55} ${headRX * 0.2} ${headCY - headRY * 0.62} ${-headRX * 1.03} ${headCY - headRY * 0.05} Z`}
          fill={f.hair}
        />
      )}
      {f.bride && (
        <path d={`M${headRX * 0.3} ${headCY - headRY * 0.9} C${headRX * 1.9} ${headCY} ${headRX * 2.1} ${shoulderY + u * 2} ${headRX * 1.4} ${waistY + u * 0.8} L${headRX * 0.9} ${shoulderY} Z`} fill="#ffffff" opacity={0.35} />
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
      const { avg, peak } = ref.current;
      const swing = Math.max(peak - avg, 3);
      const next = (v: number) => {
        const target = reduce ? avg : avg - 6 + Math.random() * (swing + 6);
        return v + (Math.min(target, peak) - v) * 0.5;
      };
      const a = next(state.a);
      const b = next(state.b) - 0.5;
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
            <linearGradient id="m-shade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
            </linearGradient>
            <radialGradient id="m-face" cx="0.38" cy="0.35" r="0.75">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="70%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
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

              {!P.indoor && p.backdrop !== "sea" && (
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
                  {p.backdrop === "buildings" ? (
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

              {lights.map((l, i) => {
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
                        {row.figures.map((f, j) => (
                          <FigureShape key={j} f={f} />
                        ))}
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
