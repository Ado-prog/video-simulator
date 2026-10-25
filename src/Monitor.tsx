import { useEffect, useRef, useState } from "react";
import type { ScenePalette, BackdropKind } from "./lighting";
import { blurDisc } from "./optics";

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
  cpl: number;
  uv: boolean;
  hud: { fps: string; shutter: string; iso: string; focus: string; profile: string; filters: string; wb: string };
  label: string;
};

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

  return (
    <figure className="monitor">
      <div className="monitor-bezel">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.label} className="monitor-screen">
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
                <feComponentTransfer>
                  <feFuncR type="gamma" amplitude={1} exponent={1 / 2.2} offset={0} />
                  <feFuncG type="gamma" amplitude={1} exponent={1 / 2.2} offset={0} />
                  <feFuncB type="gamma" amplitude={1} exponent={1 / 2.2} offset={0} />
                </feComponentTransfer>
              )}
            </filter>
            <filter id="m-grain" filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <feTurbulence type="fractalNoise" baseFrequency={1.5} numOctaves={1} seed={7} />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>

          <g clipPath="url(#m-frame)">
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

            {p.grain > 0.01 && (
              <rect width={W} height={H} filter="url(#m-grain)" opacity={p.grain} style={{ mixBlendMode: "overlay" }} />
            )}

            <g stroke="#fff" strokeOpacity={0.22} strokeWidth={0.4}>
              <line x1={W / 3} y1={0} x2={W / 3} y2={H} />
              <line x1={(2 * W) / 3} y1={0} x2={(2 * W) / 3} y2={H} />
              <line x1={0} y1={H / 3} x2={W} y2={H / 3} />
              <line x1={0} y1={(2 * H) / 3} x2={W} y2={(2 * H) / 3} />
            </g>

            {af.w < W * 1.2 && (
              <g stroke="#3ee07a" strokeWidth={1} fill="none">
                <path d={`M${af.x} ${af.y + 6} v-6 h6 M${af.x + af.w - 6} ${af.y} h6 v6 M${af.x + af.w} ${af.y + af.h - 6} v6 h-6 M${af.x + 6} ${af.y + af.h} h-6 v-6`} />
              </g>
            )}

            {isVideo && p.meter && <AudioMeter m={p.meter} H={H} />}

            <g className="hud" fontSize={7}>
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
      </div>
    </figure>
  );
}
