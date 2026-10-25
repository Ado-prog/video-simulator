import { useEffect, useRef, useState } from "react";
import type { ScenePalette } from "./lighting";
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

type Figure = { x: number; h: number; dress?: boolean; tone: string };
type Row = { offset: number; figures: Figure[] };

const TONES = ["#25242b", "#efeae2", "#3a4a5c", "#8a3b4c", "#4d5b3c", "#2c3340", "#6b4a7a"];

function rows(kind: SubjectKind): Row[] {
  if (kind === "person") return [{ offset: 0, figures: [{ x: 0, h: 1.78, tone: "#2c3340" }] }];
  if (kind === "couple")
    return [
      {
        offset: 0,
        figures: [
          { x: -0.28, h: 1.82, tone: "#25242b" },
          { x: 0.26, h: 1.66, dress: true, tone: "#efeae2" },
        ],
      },
    ];
  const n = rowCount(kind);
  return Array.from({ length: n }, (_, r) => {
    const count = 5 + r;
    const shift = r % 2 ? 0.27 : 0;
    return {
      offset: r * ROW_GAP,
      figures: Array.from({ length: count }, (_, i) => {
        const x = (i - (count - 1) / 2) * 0.55 + shift;
        const dress = (i + r) % 2 === 1;
        return { x, h: dress ? 1.64 + ((i * 7) % 5) * 0.02 : 1.76 + ((i * 3) % 4) * 0.02, dress, tone: TONES[(i * 3 + r * 2) % TONES.length] };
      }),
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
  exposureDelta: number;
  cast: [number, number, number];
  grain: number;
  logView: boolean;
  cpl: number;
  uv: boolean;
  hud: { fps: string; shutter: string; iso: string; focus: string; profile: string; filters: string; wb: string };
  label: string;
};

/** A simple standing figure, feet at y = 0, drawn upward (negative y). */
function FigureShape({ f }: { f: Figure }) {
  const h = f.h;
  const head = h * 0.066;
  const shoulderY = -h * 0.82;
  const hipY = -h * 0.5;
  const sw = h * 0.13; // half shoulder width
  const skin = "#c99a7c";
  return (
    <g transform={`translate(${f.x} 0)`}>
      {f.dress ? (
        <path
          d={`M${-sw * 0.8} ${shoulderY} L${sw * 0.8} ${shoulderY} L${sw * 0.55} ${hipY} L${h * 0.22} 0 L${-h * 0.22} 0 L${-sw * 0.55} ${hipY} Z`}
          fill={f.tone}
        />
      ) : (
        <>
          <path d={`M${-sw} ${shoulderY} L${sw} ${shoulderY} L${sw * 0.75} ${hipY} L${-sw * 0.75} ${hipY} Z`} fill={f.tone} />
          <rect x={-sw * 0.72} y={hipY} width={sw * 0.62} height={-hipY} fill={f.tone} />
          <rect x={sw * 0.1} y={hipY} width={sw * 0.62} height={-hipY} fill={f.tone} />
          <path d={`M0 ${shoulderY} l${-sw * 0.18} ${h * 0.12} l${sw * 0.18} ${h * 0.05} l${sw * 0.18} ${-h * 0.05} Z`} fill="#f4f1ec" />
        </>
      )}
      <rect x={-sw * 1.12} y={shoulderY + 0.02} width={sw * 0.3} height={h * 0.34} rx={sw * 0.15} fill={f.tone} />
      <rect x={sw * 0.82} y={shoulderY + 0.02} width={sw * 0.3} height={h * 0.34} rx={sw * 0.15} fill={f.tone} />
      <rect x={-head * 0.35} y={shoulderY - head * 0.6} width={head * 0.7} height={head * 0.7} fill={skin} />
      <circle cx={0} cy={shoulderY - head * 1.45} r={head} fill={skin} />
      <path
        d={`M${-head} ${shoulderY - head * 1.45} a${head} ${head} 0 0 1 ${head * 2} 0 q${-head} ${-head * 0.5} ${-head * 2} 0 Z`}
        fill={f.dress ? "#5a3a26" : "#2a1f19"}
      />
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

  const top = 30;
  const h = H - 62;
  const y = (db: number) => top + (Math.min(0, Math.max(-48, db)) / -48) * h;
  const bar = (x: number, v: number, p: number) => (
    <g>
      <rect x={x} y={top} width={5} height={h} fill="#000" opacity={0.45} />
      <rect x={x} y={y(v)} width={5} height={top + h - y(v)} fill="url(#m-meter)" />
      <rect x={x} y={y(p) - 0.6} width={5} height={1.2} fill="#fff" />
    </g>
  );
  return (
    <g className="hud" fontSize={5.5}>
      <defs>
        <linearGradient id="m-meter" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#36d17a" />
          <stop offset="70%" stopColor="#36d17a" />
          <stop offset="80%" stopColor="#ffd34d" />
          <stop offset="92%" stopColor="#ff4d47" />
        </linearGradient>
      </defs>
      {bar(6, lv.a, lv.pa)}
      {bar(13, lv.b, lv.pb)}
      {[0, -6, -12, -20, -40].map((d) => (
        <g key={d}>
          <line x1={19.5} y1={y(d)} x2={22} y2={y(d)} stroke="#fff" strokeWidth={0.5} />
          <text x={23.5} y={y(d) + 2}>{d}</text>
        </g>
      ))}
      <text x={6} y={top + h + 7}>1</text>
      <text x={13} y={top + h + 7}>2</text>
      {m.clip && <text x={6} y={top - 3} fill="#ff4d47">CLIP</text>}
      {!m.clip && m.limiting && <text x={6} y={top - 3} fill="#ffd34d">LIM</text>}
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

              {!P.indoor && (
                <g filter="url(#m-b-hills)">
                  <path
                    d={`M0 ${H / 2 + 1} L0 ${H / 2 - 12} Q70 ${H / 2 - 28} 140 ${H / 2 - 14} T260 ${H / 2 - 18} T320 ${H / 2 - 10} L320 ${H / 2 + 1} Z`}
                    fill={P.hills}
                    opacity={p.uv ? 0.92 : 0.78}
                  />
                </g>
              )}

              <g filter="url(#m-b-back)">
                <g transform={layer(backD)}>
                  {backItems.map((x, i) =>
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
