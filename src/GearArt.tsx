// Original illustrations for the control panel: lens, aperture iris, camera body and microphone.

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

type LensInfo = { id: string; maker: string; name: string; minFocal: number; maxFocal: number; apertureWide: number; apertureTele: number };

const SMALL_MOUNTS = ["MFT:", "E-APSC:", "RF-S:", "Z-DX:"];

/** Brand cues that make a lens recognisable: coloured ring, badge, white tele barrel. */
function lensLook(lens: LensInfo | undefined, maxF: number) {
  const n = lens?.name ?? "";
  const maker = lens?.maker ?? "";
  let ring: string | null = null;
  let badge: { fill: string; ink: string; t: string } | null = null;
  let white = false;
  let mount = "#9aa1aa";
  let ink = "var(--muted)";
  if (maker === "Canon") {
    const L = n.includes(" L ");
    ring = L ? "#d0252b" : "#aeb4bb";
    white = L && maxF >= 200;
  } else if (maker === "Sony") {
    const gm = n.includes(" GM");
    const g = gm || n.includes(" G ") || n.endsWith(" G");
    if (g) badge = { fill: gm ? "#e8641b" : "#3a3f47", ink: "#fff", t: "G" };
    white = g && maxF >= 200 && n.startsWith("FE");
  } else if (maker === "Nikon") {
    if (n.includes("Plena")) ring = "#d9b24a";
    else if (n.endsWith(" S") || n.includes(" S ")) ring = "#c9ced4";
  } else if (maker === "Sigma") {
    badge = { fill: "#d9dde2", ink: "#16181c", t: n.includes("Art") ? "A" : n.includes("Sports") ? "S" : "C" };
  } else if (maker === "Tamron") {
    mount = "#d9c9a3";
  } else if (maker === "Panasonic") {
    if (n.includes("Leica")) ink = "#f2c230";
    else if (n.includes("PRO")) ring = "#8d949c";
  }
  return { ring, badge, white, mount, ink };
}

/**
 * Side view of the chosen lens in roughly true proportions (length and diameter are estimated
 * from focal length and speed), with a schematic optical section drawn into the barrel.
 */
export function LensArt({ focal, minF, maxF, maxAperture, lens }: { focal: number; minF: number; maxF: number; maxAperture: number; lens?: LensInfo }) {
  const zoom = minF !== maxF;
  const fixed = !!lens && lens.id.startsWith("fx:");
  const small = !!lens && SMALL_MOUNTS.some((m) => lens.id.startsWith(m));
  const apW = lens ? lens.apertureWide : maxAperture;
  const apT = lens ? lens.apertureTele : maxAperture;
  const pupil = maxF / apT;
  let diaMm = 58 + 0.3 * pupil + (zoom ? 8 : 0) + (zoom && apW <= 2.8 ? 8 : 0) + (!zoom && apW <= 1.4 ? 6 : 0);
  let lenMm = zoom ? 45 + 8 * Math.sqrt(maxF) + (apW <= 2.8 ? 15 : 0) : 40 + maxF * 0.7 + (apW <= 1.4 ? 35 : apW <= 1.8 ? 10 : 0);
  if (zoom && apT >= 5.6 && maxF <= 250) lenMm *= 0.75;
  if (small) { diaMm *= 0.8; lenMm *= 0.8; }
  if (fixed) { diaMm = 46; lenMm = 26; }
  const S = 0.6; // px per mm
  const D = clamp(diaMm, 44, 100) * S;
  const L = clamp(lenMm, 24, 215) * S;
  const look = lensLook(lens, maxF);
  const internal = !zoom || fixed || (minF >= 70 && apW <= 2.8) || (lens?.name.includes("PZ") ?? false);
  const tz = zoom ? clamp((focal - minF) / (maxF - minF), 0, 1) : 0;
  const ext = internal ? 0 : L * 0.3 * tz;
  const H = 94;
  const x0 = 22;
  const cy = 40;
  const front = x0 + L + ext;
  // short lenses get a narrower frame so they are still drawn large enough to read
  const W = Math.max(124, Math.round(x0 + L * (internal ? 1 : 1.3) + 22));
  const collar = !fixed && maxF >= 200 && (look.white || apW <= 2.8 || maxF >= 400);
  const ap = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const label = `${minF === maxF ? minF : `${minF}–${maxF}`} mm` + (lens ? `  f/${apW === apT ? ap(apW) : `${ap(apW)}–${ap(apT)}`}` : "");
  const bodyFill = look.white ? "url(#lens-white)" : "url(#lens-body)";
  const ringFill = look.white ? "#c9ccd0" : "#25292f";
  const rib = look.white ? "#a9adb3" : "#3c424a";
  const glass = look.white ? "#1f6fb5" : "#8fd3ff";

  // ribbed ring between two fractions of the barrel length
  const ribbed = (a: number, b: number, key: string) => {
    const xa = x0 + L * a;
    const w = L * (b - a);
    const n = Math.max(3, Math.round(w / 3.2));
    return (
      <g key={key}>
        <rect x={xa} y={cy - D / 2 - 1} width={w} height={D + 2} rx={3} fill={ringFill} />
        {Array.from({ length: n }, (_, i) => {
          const x = xa + 2 + (i * (w - 4)) / Math.max(1, n - 1);
          return <line key={i} x1={x} y1={cy - D / 2} x2={x} y2={cy + D / 2} stroke={rib} strokeWidth={1} />;
        })}
      </g>
    );
  };

  // optical section: element at fraction p (0 = mount, 1 = front), half height h, thickness t,
  // cl / cr = how far the rear / front surface bulges outwards (negative = concave)
  const xr = x0 + 4;
  const span = front - 6 - xr;
  const el = (p: number, h: number, t: number, cl: number, cr: number) => {
    const x = xr + span * p;
    return `M${x - t / 2} ${cy - h} Q${x - t / 2 - cl} ${cy} ${x - t / 2} ${cy + h} L${x + t / 2} ${cy + h} Q${x + t / 2 + cr} ${cy} ${x + t / 2} ${cy - h} Z`;
  };
  const hf = D / 2 - 4;
  const hr = D * 0.27;
  const hs = clamp((D * 0.3) / Math.sqrt(apW / 1.4), D * 0.1, D * 0.3);
  const wide = minF < 35;
  const dense = span > 44;
  const els: string[] = [];
  if (wide) {
    els.push(el(0.97, hf, 4, -8, 7));
    if (dense) els.push(el(0.85, hf * 0.8, 4, -6, 3));
    els.push(el(0.72, hf * 0.62, 5, 4, 5));
  } else {
    els.push(el(0.96, hf, 5, 3, 8));
    if (dense) els.push(el(0.86, hf * 0.86, 4, -4, 6));
    if (maxF >= 100) els.push(el(0.72, hf * 0.6, 4, -4, -3));
  }
  if (zoom && dense) {
    els.push(el(0.5 + 0.1 * tz, hf * 0.5, 5, -4, -4));
    els.push(el(0.43, hf * 0.48, 5, 4, 4));
  } else if (!wide && dense) {
    els.push(el(0.5, hf * 0.55, 5, 4, 4));
  }
  els.push(el(0.26, hr, 5, 4, 4));
  if (dense) els.push(el(0.16, hr * 0.9, 4.5, -3, -3));
  els.push(el(0.06, hr, 4, 3, 4));
  const stopX = xr + span * 0.35;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="art art-lens" role="img" aria-label={lens ? `${lens.maker} ${lens.name}` : label}>
      <defs>
        <linearGradient id="lens-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#454b54" />
          <stop offset="45%" stopColor="#1b1e23" />
          <stop offset="100%" stopColor="#0d0f12" />
        </linearGradient>
        <linearGradient id="lens-white" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbfbf8" />
          <stop offset="50%" stopColor="#e4e3dd" />
          <stop offset="100%" stopColor="#a9a8a2" />
        </linearGradient>
        <radialGradient id="lens-glass" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="#9fd0ff" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#3a5fa8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#1a1030" />
        </radialGradient>
      </defs>
      {/* bayonet */}
      <rect x={x0 - 7} y={cy - D * 0.3} width={8} height={D * 0.6} rx={1.5} fill={look.mount} />
      {/* tripod collar */}
      {collar && (
        <g>
          <rect x={x0 + L * 0.24} y={cy + D / 2 - 2} width={L * 0.1} height={11} fill={look.white ? "#c9ccd0" : "#2b3036"} />
          <rect x={x0 + L * 0.16} y={cy + D / 2 + 8} width={L * 0.26} height={4.5} rx={1.5} fill="#16181c" />
        </g>
      )}
      {/* inner barrel that comes out when zooming */}
      {ext > 0.5 && <rect x={x0 + L * 0.7} y={cy - D * 0.43} width={L * 0.3 + ext} height={D * 0.86} rx={3} fill={look.white ? "#d9d8d2" : "#15181c"} stroke={rib} strokeWidth={0.6} />}
      {/* barrel: narrow rear part, then the full diameter */}
      <rect x={x0} y={cy - D * 0.4} width={L * 0.2} height={D * 0.8} rx={3} fill={bodyFill} />
      <rect x={x0 + L * 0.1} y={cy - D / 2} width={L * 0.9} height={D} rx={4} fill={bodyFill} />
      {zoom && !fixed ? [ribbed(0.36, 0.62, "z"), ribbed(0.72, 0.9, "f")] : !fixed && ribbed(0.42, 0.8, "f")}
      {/* brand ring near the front */}
      {look.ring && <rect x={x0 + L - 5.5} y={cy - D / 2} width={2.4} height={D} fill={look.ring} />}
      {/* front element */}
      <ellipse cx={front} cy={cy} rx={5} ry={(ext > 0.5 ? D * 0.43 : D / 2) - 2} fill="url(#lens-glass)" />
      {/* optical section */}
      <g fill={glass} fillOpacity={0.2} stroke={glass} strokeWidth={0.8} strokeOpacity={0.85} strokeLinejoin="round">
        {els.map((d, i) => <path key={i} d={d} />)}
        <line x1={stopX} y1={cy - hf * 0.75} x2={stopX} y2={cy - hs} strokeWidth={1.2} />
        <line x1={stopX} y1={cy + hs} x2={stopX} y2={cy + hf * 0.75} strokeWidth={1.2} />
      </g>
      <line x1={x0 - 10} y1={cy} x2={front + 10} y2={cy} stroke={glass} strokeWidth={0.5} strokeDasharray="5 2 1 2" opacity={0.55} />
      {/* series badge */}
      {look.badge && (
        <g>
          <rect x={x0 + L * 0.2} y={cy - D * 0.36} width={8} height={8} rx={2} fill={look.badge.fill} />
          <text x={x0 + L * 0.2 + 4} y={cy - D * 0.36 + 6.3} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={look.badge.ink}>{look.badge.t}</text>
        </g>
      )}
      <text x={W / 2} y={H - 4} className="art-text" textAnchor="middle" fill={look.ink} fontSize={9}>
        {label}
      </text>
    </svg>
  );
}

/** Seven-blade iris; the opening shrinks with the f-number (diameter ∝ 1/N). */
export function IrisArt({ aperture }: { aperture: number }) {
  const R = 34;
  const r = R * clamp(1.15 / aperture, 0.05, 0.93);
  const blades = 7;
  const c = 40;
  const pts = Array.from({ length: blades }, (_, i) => {
    const a = (i / blades) * Math.PI * 2 - Math.PI / 2;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  });
  return (
    <svg viewBox="0 0 80 80" className="art art-iris" role="img" aria-label={`f/${aperture}`}>
      <defs>
        <radialGradient id="iris-blade" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#3b4048" />
          <stop offset="100%" stopColor="#14171b" />
        </radialGradient>
        <radialGradient id="iris-light" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="100%" stopColor="#f0ab3c" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={R + 4} fill="#0b0d10" />
      <circle cx={c} cy={c} r={R} fill="url(#iris-light)" />
      {pts.map(([px, py], i) => {
        const [nx, ny] = pts[(i + 1) % blades];
        const a1 = Math.atan2(py - c, px - c);
        const a2 = Math.atan2(ny - c, nx - c);
        const o1 = [c + (R + 2) * Math.cos(a1 + 0.9), c + (R + 2) * Math.sin(a1 + 0.9)];
        const o2 = [c + (R + 2) * Math.cos(a2 + 0.9), c + (R + 2) * Math.sin(a2 + 0.9)];
        return (
          <path
            key={i}
            d={`M${px} ${py} L${nx} ${ny} L${o2[0]} ${o2[1]} A${R + 2} ${R + 2} 0 0 0 ${o1[0]} ${o1[1]} Z`}
            fill="url(#iris-blade)"
            stroke="#5a616b"
            strokeWidth={0.6}
          />
        );
      })}
      <circle cx={c} cy={c} r={R + 4} fill="none" stroke="#2b3036" strokeWidth={3} />
    </svg>
  );
}

export type CameraKind = "mirrorless" | "action" | "gimbal" | "cam360" | "drone";

export function cameraKind(id: string | undefined): CameraKind {
  if (!id) return "mirrorless";
  if (id.startsWith("insta-") || id === "dji-osmo360") return "cam360";
  if (id === "dji-pocket3") return "gimbal";
  if (id === "dji-action5" || id === "dji-action4" || id === "dji-nano") return "action";
  if (id.startsWith("dji-")) return "drone";
  return "mirrorless";
}

const CINE = ["sony-fx3", "sony-fx30", "sony-fx2", "sony-fx5", "nikon-zr"];
const FLAT = ["pana-s9", "sony-a7cii", "sony-zve1", "sony-a6700", "sony-zve10ii"];
const PRO = ["canon-r1", "canon-r3", "nikon-z9"];
const RETRO = ["nikon-zf", "nikon-zfc"];
const COMPACT = ["pana-s9", "sony-a7cii", "sony-zve1", "sony-a6700", "sony-zve10ii", "sony-fx30", "canon-r8", "canon-r7", "canon-r10", "canon-r50", "nikon-z50ii", "nikon-zfc", "pana-s5", "pana-s5ii", "pana-s5iix"];
const FPV = ["dji-avata2", "dji-avata360", "dji-neo"];

type CamInfo = { id: string; brand: string; model: string };

/** Front view of the camera body; the shape follows the model's body style and the brand's accents. */
export function CameraArt({ kind, label, cam }: { kind: CameraKind; label: string; cam?: CamInfo }) {
  const body = "#1d2026";
  const edge = "#3a3f47";
  const id = cam?.id ?? "";
  const brand = cam?.brand ?? "";
  const style = CINE.includes(id) ? "cine" : FLAT.includes(id) ? "flat" : PRO.includes(id) ? "pro" : RETRO.includes(id) ? "retro" : "slr";
  const k = id === "canon-r50" || id === "sony-zve10ii" ? 0.8 : COMPACT.includes(id) ? 0.9 : 1;
  const mountRing = brand === "Sony" ? "#e0742a" : "#aeb4bb";
  const badge = (cam?.model ?? "").replace("Lumix ", "").replace("Alpha ", "α").replace("EOS ", "").replace(" Mark II", " II");
  const cyl = style === "pro" ? 42 : 49;
  const mount = (
    <g>
      <circle cx="64" cy={cyl} r="20" fill="#2b3036" />
      <circle cx="64" cy={cyl} r="18.6" fill="none" stroke={mountRing} strokeWidth="1.6" />
      <circle cx="64" cy={cyl} r="14" fill="url(#cam-glass)" />
      <ellipse cx="59" cy={cyl - 5} rx="3.5" ry="2" fill="#fff" opacity="0.35" />
    </g>
  );
  return (
    <svg viewBox="0 0 120 84" className="art art-camera" role="img" aria-label={label}>
      <defs>
        <radialGradient id="cam-glass" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="#9fd0ff" />
          <stop offset="45%" stopColor="#2c4c8c" />
          <stop offset="100%" stopColor="#0d0a1c" />
        </radialGradient>
      </defs>
      {kind === "mirrorless" && (
        <g transform={`translate(60 46) scale(${k}) translate(-60 -46)`}>
          {style === "slr" && (
            <g>
              <path d="M14 26 h24 l6 -9 h28 l6 9 h28 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 H14 a6 6 0 0 1 -6 -6 V32 a6 6 0 0 1 6 -6 z" fill={body} stroke={edge} />
              <rect x="8" y="30" width="21" height="42" rx="7" fill="#2a2e35" />
              <rect x="90" y="20.5" width="12" height="5.5" rx="2" fill={edge} />
              <circle cx="19" cy="23" r="4.2" fill={edge} />
            </g>
          )}
          {style === "pro" && (
            <g>
              <path d="M14 18 h24 l6 -9 h28 l6 9 h28 a6 6 0 0 1 6 6 v48 a6 6 0 0 1 -6 6 H14 a6 6 0 0 1 -6 -6 V24 a6 6 0 0 1 6 -6 z" fill={body} stroke={edge} />
              <rect x="8" y="22" width="21" height="56" rx="7" fill="#2a2e35" />
              <rect x="8" y="64" width="104" height="14" rx="6" fill="#23272d" />
              <circle cx="19" cy="15.5" r="4.2" fill={edge} />
              <circle cx="100" cy="71" r="3" fill={edge} />
            </g>
          )}
          {style === "flat" && (
            <g>
              <rect x="8" y="24" width="104" height="48" rx="7" fill={body} stroke={edge} />
              <rect x="8" y="27" width="19" height="45" rx="7" fill="#2a2e35" />
              <rect x="52" y="20.5" width="16" height="4" rx="1" fill={edge} />
              <circle cx="96" cy="22.5" r="4.5" fill={edge} />
              <circle cx="18" cy="22.5" r="3.6" fill={edge} />
            </g>
          )}
          {style === "cine" && (
            <g>
              <rect x="10" y="20" width="100" height="52" rx="5" fill={body} stroke={edge} />
              <rect x="10" y="24" width="20" height="48" rx="6" fill="#2a2e35" />
              {[40, 52, 76, 88].map((x) => <circle key={x} cx={x} cy="23.5" r="1.3" fill="#0a0b0d" />)}
              {[0, 1, 2, 3].map((i) => <line key={i} x1="96" y1={34 + i * 5} x2="106" y2={34 + i * 5} stroke={edge} strokeWidth="1.4" />)}
              <rect x="16" y="15.5" width="13" height="5" rx="2" fill="var(--tally)" />
            </g>
          )}
          {style === "retro" && (
            <g>
              <rect x="8" y="27" width="104" height="45" rx="5" fill={body} stroke={edge} />
              <path d="M8 36 V30 a4 4 0 0 1 4 -4 h28 l6 -9 h24 l6 9 h28 a4 4 0 0 1 4 4 v6 z" fill="#b9bec5" stroke="#8d949c" />
              <rect x="14" y="20" width="12" height="6" rx="1.5" fill="#b9bec5" stroke="#8d949c" />
              <rect x="88" y="19.5" width="13" height="6.5" rx="1.5" fill="#b9bec5" stroke="#8d949c" />
              <rect x="104" y="21.5" width="6" height="4.5" rx="1.5" fill="#b9bec5" stroke="#8d949c" />
            </g>
          )}
          {mount}
          {brand === "Nikon" && <path d="M22 34 l5 0 l-4 12 z" fill="#d0252b" />}
          {brand === "Canon" && style !== "pro" && <rect x="9" y="44" width="19" height="1.6" fill="#d0252b" opacity="0.85" />}
          {brand === "Panasonic" && <circle cx="19" cy={style === "flat" ? 22.5 : 23} r="1.8" fill="#d0252b" />}
          {style !== "cine" && <circle cx="103" cy={style === "pro" ? 26 : 33} r="2.2" fill="var(--tally)" />}
          {badge && (
            <text x="110" y={style === "pro" ? 61 : 69} textAnchor="end" fontSize="6.2" fontWeight="700" fill="#cfd5db">{badge}</text>
          )}
        </g>
      )}
      {kind === "action" && (id === "dji-nano" ? (
        <g>
          <rect x="40" y="26" width="42" height="30" rx="13" fill={body} stroke={edge} />
          <circle cx="68" cy="41" r="10" fill="#2b3036" />
          <circle cx="68" cy="41" r="7" fill="url(#cam-glass)" />
          <circle cx="50" cy="41" r="2" fill="var(--tally)" />
        </g>
      ) : (
        <g>
          <rect x="30" y="16" width="62" height="50" rx="9" fill={body} stroke={edge} />
          <rect x="36" y="22" width="22" height="16" rx="3" fill="#0e1014" stroke={edge} />
          <circle cx="74" cy="44" r="13" fill="#2b3036" />
          <circle cx="74" cy="44" r="9" fill="url(#cam-glass)" />
          <rect x="44" y="12" width="14" height="5" rx="2" fill="var(--tally)" />
        </g>
      ))}
      {kind === "gimbal" && (
        <g>
          <rect x="50" y="36" width="20" height="44" rx="8" fill={body} stroke={edge} />
          <rect x="54" y="42" width="12" height="18" rx="2" fill="#0e1014" />
          <path d="M60 36 v-6" stroke={edge} strokeWidth="4" />
          <path d="M76 30 h6 v-22 h-8" fill="none" stroke={edge} strokeWidth="3.5" strokeLinejoin="round" />
          <rect x="44" y="8" width="32" height="22" rx="8" fill={body} stroke={edge} />
          <circle cx="60" cy="19" r="8" fill="url(#cam-glass)" />
        </g>
      )}
      {kind === "cam360" && (id === "dji-osmo360" ? (
        <g>
          <rect x="36" y="14" width="48" height="56" rx="12" fill={body} stroke={edge} />
          <circle cx="60" cy="34" r="16" fill="#2b3036" />
          <circle cx="60" cy="34" r="12" fill="url(#cam-glass)" />
          <circle cx="60" cy="61" r="2.5" fill="var(--tally)" />
        </g>
      ) : (
        <g>
          <rect x="46" y="6" width="28" height="74" rx="12" fill={body} stroke={edge} />
          <circle cx="60" cy="22" r="12" fill="#2b3036" />
          <circle cx="60" cy="22" r="9" fill="url(#cam-glass)" />
          <rect x="52" y="42" width="16" height="12" rx="2" fill="#0e1014" />
          <circle cx="60" cy="68" r="2.5" fill="var(--tally)" />
        </g>
      ))}
      {kind === "drone" && (FPV.includes(id) ? (
        <g>
          {[[36, 26], [84, 26], [36, 58], [84, 58]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="15" fill="#15181c" stroke={edge} strokeWidth="3" />
              <line x1={x - 11} y1={y} x2={x + 11} y2={y} stroke="#5b636e" strokeWidth="2" strokeLinecap="round" />
              <circle cx={x} cy={y} r="2.6" fill={body} stroke={edge} />
            </g>
          ))}
          <rect x="47" y="24" width="26" height="38" rx="9" fill={body} stroke={edge} />
          <circle cx="60" cy="31" r={id === "dji-avata360" ? 8 : 6} fill="#2b3036" />
          <circle cx="60" cy="31" r={id === "dji-avata360" ? 6 : 4.2} fill="url(#cam-glass)" />
        </g>
      ) : (
        <g>
          {[[22, 22], [98, 22], [22, 62], [98, 62]].map(([x, y], i) => (
            <g key={i}>
              <line x1="60" y1="42" x2={x} y2={y} stroke={edge} strokeWidth="5" strokeLinecap="round" />
              <ellipse cx={x} cy={y} rx="17" ry="4" fill="#5b636e" opacity="0.6" />
              <circle cx={x} cy={y} r="4" fill={body} />
            </g>
          ))}
          <rect x="42" y="30" width="36" height="24" rx="9" fill={body} stroke={edge} />
          {id.startsWith("dji-mavic") ? (
            <g>
              <rect x="49" y="50" width="22" height="17" rx="5" fill="#2b3036" />
              <circle cx="60" cy="61" r="4.6" fill="url(#cam-glass)" />
              <circle cx="54.5" cy="54" r="2.4" fill="url(#cam-glass)" />
              <circle cx="65.5" cy="54" r="2.4" fill="url(#cam-glass)" />
            </g>
          ) : (
            <g>
              <circle cx="60" cy="56" r="7" fill="#2b3036" />
              <circle cx="60" cy="56" r="5" fill="url(#cam-glass)" />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

type MicInfo = { id: string; brand: string; name: string; type: string; stereo?: string };

// Real lengths in mm (rounded) so the drawing shows how big the microphone is.
const MIC_LEN: Record<string, number> = {
  "rode-vmntg": 171, "rode-vmgo2": 150, "rode-vmicro2": 80, "rode-vmproplus": 170, "senn-mke600": 256, "senn-mke400": 126,
  "senn-mke200": 69, "deity-d3pro": 198, "pana-ms2": 140, "nikon-me1": 80, "rode-ntg4p": 278, "rode-ntg5": 203,
  "sony-ecmb10": 79, "sony-ecmb1m": 100, "pana-dms1": 110, "canon-dme1d": 95,
};
const MIC_BOXY = ["sony-ecmb10", "sony-ecmb1m", "pana-dms1", "canon-dme1d"];
const MIC_FOAM = ["rode-vmicro2", "senn-mke200", "nikon-me1", "senn-mke400"];
const MIC_PACK = ["zoom-f2", "tascam-dr10l", "senn-ewdp"];
const MIC_ROUND = ["holly-m2", "holly-m2s", "holly-c1", "dji-micmini", "shure-movemic", "rode-wmicro", "comica-vimo"];
const MIC_SCREEN = ["rode-wpro", "rode-wgo3", "rode-wgo2", "dji-mic3", "dji-mic2", "dji-mic1", "holly-max", "sara-ultra", "deity-theos", "senn-profile"];
const MIC_DOT: Record<string, string> = {
  "RØDE": "#c9a227", DJI: "#e9edf1", Sennheiser: "#3da5ff", Hollyland: "#f08a24", Saramonic: "#e0393e", Deity: "#f08a24",
  Sony: "#e0742a", Panasonic: "#d0252b", Canon: "#d0252b", Nikon: "#f2c230", Zoom: "#e0393e", Tascam: "#e0393e", Shure: "#7bd88f", Comica: "#3da5ff",
};

/** The chosen microphone: wireless set, lav recorder, shoe mic, shotgun or boom, drawn to its real length. */
export function MicArt({ mic }: { mic: MicInfo }) {
  const body = "#1d2026";
  const edge = "#3a3f47";
  const dot = MIC_DOT[mic.brand] ?? "var(--accent)";
  const label = mic.type === "internal" ? "internal" : `${mic.brand} ${mic.name}`;
  const kind = mic.type === "internal" ? "internal" : mic.type === "boom" ? "boom" : mic.type === "lav" ? (MIC_PACK.includes(mic.id) ? "pack" : "wireless") : MIC_BOXY.includes(mic.id) ? "boxy" : "shotgun";
  const len = (MIC_LEN[mic.id] ?? 150) * 0.36;
  const foam = MIC_FOAM.includes(mic.id);
  const round = MIC_ROUND.includes(mic.id);
  const two = mic.stereo === "split";
  // one transmitter (clip-on) at x, y
  const tx = (x: number, y: number, key: number) =>
    round ? (
      <g key={key}>
        <circle cx={x + 9} cy={y + 9} r="9.5" fill={body} stroke={edge} />
        <circle cx={x + 9} cy={y + 9} r="3.4" fill="#0a0b0d" stroke={edge} strokeWidth="0.6" />
        <circle cx={x + 15} cy={y + 3.5} r="1.3" fill={dot} />
      </g>
    ) : (
      <g key={key}>
        <rect x={x} y={y} width="20" height="20" rx="4" fill={body} stroke={edge} />
        <rect x={x + 6.5} y={y - 2.5} width="7" height="3.5" rx="1.5" fill="#0a0b0d" stroke={edge} strokeWidth="0.6" />
        <circle cx={x + 10} cy={y + 10} r="3" fill={dot} opacity="0.9" />
        <circle cx={x + 16} cy={y + 4} r="1.2" fill="#7bd88f" />
      </g>
    );
  const slots = (x: number, w: number, y: number) =>
    Array.from({ length: Math.max(2, Math.round(w / 5)) }, (_, i) => <rect key={i} x={x + 2 + i * 5} y={y} width="3" height="1.4" rx="0.7" fill="#07080a" />);
  return (
    <svg viewBox="0 0 120 64" className="art art-mic" role="img" aria-label={label}>
      {kind === "internal" && (
        <g>
          <path d="M30 26 h18 l5 -8 h22 l5 8 h10 a5 5 0 0 1 5 5 v19 H25 V31 a5 5 0 0 1 5 -5 z" fill={body} stroke={edge} />
          {[0, 1, 2].map((i) => [0, 1].map((j) => <circle key={`${i}${j}`} cx={38 + i * 3.4} cy={32 + j * 3.4} r="1" fill="#8fd3ff" />))}
          {[0, 1, 2].map((i) => [0, 1].map((j) => <circle key={`r${i}${j}`} cx={77 + i * 3.4} cy={32 + j * 3.4} r="1" fill="#8fd3ff" />))}
        </g>
      )}
      {kind === "wireless" && (
        <g>
          {/* receiver on the camera */}
          <rect x="18" y="22" width="24" height="24" rx="4" fill={body} stroke={edge} />
          {MIC_SCREEN.includes(mic.id) ? (
            <g>
              <rect x="21.5" y="26" width="17" height="11" rx="1.5" fill="#0b2a3a" stroke={edge} strokeWidth="0.6" />
              <rect x="23.5" y="29" width="9" height="1.6" fill="#7bd88f" />
              <rect x="23.5" y="32.5" width="6" height="1.6" fill="#7bd88f" />
            </g>
          ) : (
            <circle cx="30" cy="34" r="3" fill={dot} opacity="0.9" />
          )}
          <rect x="24" y="46" width="12" height="4" rx="1" fill="#8d949c" />
          {/* radio link */}
          {[0, 1, 2].map((i) => <path key={i} d={`M${48 + i * 5} ${27 - i} q4 ${7 + i} 0 ${14 + i * 2}`} fill="none" stroke={dot} strokeWidth="1.2" strokeLinecap="round" opacity={0.75 - i * 0.2} />)}
          {two ? [tx(66, 24, 0), tx(91, 24, 1)] : tx(76, 24, 0)}
        </g>
      )}
      {kind === "pack" && (
        <g>
          <rect x="24" y="20" width="26" height="34" rx="4" fill={body} stroke={edge} />
          <rect x="28" y="25" width="18" height="10" rx="1.5" fill="#0b2a3a" stroke={edge} strokeWidth="0.6" />
          <circle cx="37" cy="45" r="3" fill={dot} />
          {mic.id === "senn-ewdp" && <line x1="29" y1="20" x2="29" y2="6" stroke={edge} strokeWidth="2.4" strokeLinecap="round" />}
          <path d="M44 20 C46 4 70 6 74 22 S88 40 94 30" fill="none" stroke="#5b636e" strokeWidth="1.4" />
          <rect x="91" y="19" width="7" height="12" rx="3.5" fill="#0a0b0d" stroke={edge} />
          <path d="M98 28 l8 3 l-8 3 z" fill="#8d949c" />
        </g>
      )}
      {(kind === "shotgun" || kind === "boxy") && (
        <g>
          {/* hot shoe foot and shock mount */}
          <rect x="50" y="52" width="20" height="4" rx="1" fill="#8d949c" />
          <rect x="55" y="42" width="10" height="11" rx="2" fill="#2b3036" />
          {kind === "shotgun" ? (
            <g>
              <path d="M49 44 q-4 -12 4 -20 M71 44 q4 -12 -4 -20" fill="none" stroke="#d0252b" strokeWidth="1.6" opacity="0.8" />
              <rect x={60 - len / 2} y="24" width={len} height="11" rx="5.5" fill={body} stroke={edge} />
              {foam ? (
                <rect x={60 - len / 2 - 3} y="21.5" width={len * 0.62} height="16" rx="8" fill="#33373e" stroke="#4a5059" strokeDasharray="1.5 1.5" />
              ) : (
                slots(60 - len / 2 + 2, len * 0.6, 28.8)
              )}
              <circle cx={60 + len / 2 - 6} cy="29.5" r="1.4" fill={dot} />
              <path d={`M${60 + len / 2} 30 q9 2 5 12 t-8 10`} fill="none" stroke="#5b636e" strokeWidth="1.3" />
            </g>
          ) : (
            <g>
              <rect x={60 - len / 2} y="26" width={len} height="17" rx="3.5" fill={body} stroke={edge} />
              <rect x={60 - len / 2 + 2} y="28.5" width={len * 0.55} height="12" rx="2" fill="#0e1014" stroke={edge} strokeWidth="0.6" />
              {slots(60 - len / 2 + 2.5, len * 0.5, 31)}
              {slots(60 - len / 2 + 2.5, len * 0.5, 34)}
              {slots(60 - len / 2 + 2.5, len * 0.5, 37)}
              <circle cx={60 + len / 2 - 5} cy="34.5" r="1.5" fill={dot} />
              {[0, 1, 2, 3].map((i) => <rect key={i} x={53 + i * 4} y="56" width="2" height="2" fill="#f2c230" />)}
            </g>
          )}
        </g>
      )}
      {kind === "boom" && (
        <g>
          <line x1="96" y1="62" x2="76" y2="38" stroke="#5b636e" strokeWidth="4" strokeLinecap="round" />
          <path d="M66 40 q-3 -10 4 -17 M86 40 q3 -10 -4 -17" fill="none" stroke="#d0252b" strokeWidth="1.6" opacity="0.8" />
          <rect x="68" y="36" width="16" height="5" rx="2" fill="#2b3036" />
          <rect x={64 - len / 2} y="23" width={len} height="10" rx="5" fill={body} stroke={edge} />
          {slots(64 - len / 2 + 2, len * 0.66, 27.3)}
          <circle cx={64 + len / 2 - 6} cy="28" r="1.4" fill={dot} />
        </g>
      )}
    </svg>
  );
}

const CREDIT_TXT: Record<string, [string, string, string]> = {
  // [photo, AI illustration – not an original photo, maker refused the originals]
  de: ["Foto", "KI-Illustration, kein Originalfoto", "Nikon hat die Nutzung der Originalfotos nicht erlaubt"],
  bs: ["Foto", "AI ilustracija, nije originalna fotografija", "Nikon nije dozvolio korištenje originalnih fotografija"],
  sr: ["Foto", "AI ilustracija, nije originalna fotografija", "Nikon nije dozvolio korišćenje originalnih fotografija"],
  sq: ["Foto", "Ilustrim me AI, jo foto origjinale", "Nikon nuk lejoi përdorimin e fotove origjinale"],
  en: ["Photo", "AI illustration, not an original photo", "Nikon did not allow the use of its original photos"],
  tr: ["Fotoğraf", "Yapay zekâ illüstrasyonu, orijinal fotoğraf değil", "Nikon orijinal fotoğrafların kullanımına izin vermedi"],
  es: ["Foto", "Ilustración con IA, no es una foto original", "Nikon no permitió usar sus fotos originales"],
  fr: ["Photo", "Illustration IA, pas une photo originale", "Nikon n'a pas autorisé l'utilisation de ses photos originales"],
  ru: ["Фото", "ИИ-иллюстрация, не оригинальное фото", "Nikon не разрешил использовать оригинальные фото"],
  ja: ["写真", "AIイラスト（実物写真ではありません）", "Nikonは公式写真の使用を許可しませんでした"],
  zh: ["照片", "AI 插画，非原始照片", "Nikon 未允许使用其原始照片"],
  ko: ["사진", "AI 일러스트, 실제 사진 아님", "Nikon이 원본 사진 사용을 허락하지 않았습니다"],
};

/** A real photograph of the gear with the credit its licence asks for. */
export function GearPhotoView({ photo, label, lang = "de" }: { photo: { src: string; author: string; license: string; page: string; w: number; h: number }; label: string; lang?: string }) {
  const [ph, ai, refused] = CREDIT_TXT[lang] ?? CREDIT_TXT.en;
  const aiNote = photo.author === "KI" ? "" : ` – ${photo.author.startsWith("Nikon hat") ? refused : photo.author}`;
  const credit = photo.license === "KI" ? `${ai}${aiNote}` : photo.license === "©" ? `${ph}: © ${photo.author}` : `${ph}: ${photo.author} · ${photo.license}`;
  return (
    <figure className="gear-photo">
      <img src={photo.src} alt={label} title={credit} width={photo.w} height={photo.h} loading="lazy" className={photo.license === "©" || photo.license === "KI" ? "on-white" : undefined} />
      <figcaption>
        <span className="gear-name">{label}</span>
        <a href={photo.page} target="_blank" rel="noreferrer" title={credit} aria-label={credit}>ⓘ</a>
      </figcaption>
    </figure>
  );
}
