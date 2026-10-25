// Original illustrations for the control panel: lens, aperture iris and camera body.

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Side view of a lens that grows with focal length and gets fatter when it is fast. */
export function LensArt({ focal, minF, maxF, maxAperture }: { focal: number; minF: number; maxF: number; maxAperture: number }) {
  const t = clamp(Math.log(focal / 10) / Math.log(400 / 10), 0, 1);
  const length = 46 + t * 120;
  const dia = clamp(40 + 18 / maxAperture + t * 14, 38, 66);
  const W = 220;
  const H = 80;
  const x0 = 22;
  const cy = H / 2;
  const front = x0 + length;
  const label = minF === maxF ? `${minF} mm` : `${minF}–${maxF} mm`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="art art-lens" role="img" aria-label={`${label} f/${maxAperture}`}>
      <defs>
        <linearGradient id="lens-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3f47" />
          <stop offset="45%" stopColor="#1b1e23" />
          <stop offset="100%" stopColor="#0d0f12" />
        </linearGradient>
        <radialGradient id="lens-glass" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="#9fd0ff" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#3a5fa8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#1a1030" />
        </radialGradient>
      </defs>
      {/* camera mount */}
      <rect x={x0 - 12} y={cy - dia * 0.42} width={12} height={dia * 0.84} rx={2} fill="#9aa1aa" />
      {/* barrel */}
      <rect x={x0} y={cy - dia / 2} width={length} height={dia} rx={6} fill="url(#lens-body)" />
      {/* zoom ring */}
      {minF !== maxF && (
        <g>
          <rect x={x0 + length * 0.18} y={cy - dia / 2 - 1} width={length * 0.32} height={dia + 2} rx={4} fill="#25292f" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={x0 + length * 0.18 + 4 + i * ((length * 0.32 - 8) / 11)} y1={cy - dia / 2} x2={x0 + length * 0.18 + 4 + i * ((length * 0.32 - 8) / 11)} y2={cy + dia / 2} stroke="#3c424a" strokeWidth={1.4} />
          ))}
        </g>
      )}
      {/* focus ring */}
      <rect x={x0 + length * 0.62} y={cy - dia / 2 - 1} width={length * 0.2} height={dia + 2} rx={4} fill="#2b3036" />
      {/* accent band */}
      <rect x={front - 9} y={cy - dia / 2} width={3} height={dia} fill="var(--accent)" />
      {/* front element */}
      <ellipse cx={front} cy={cy} rx={7} ry={dia / 2 - 2} fill="url(#lens-glass)" />
      <ellipse cx={front - 1.5} cy={cy - dia * 0.18} rx={2} ry={dia * 0.12} fill="#fff" opacity={0.45} />
      <text x={x0 + length * 0.66} y={cy + 3} className="art-text" textAnchor="middle" fill="#cfd5db" fontSize={8}>
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

/** Simple, brand-free camera body for the chosen kind. */
export function CameraArt({ kind, label }: { kind: CameraKind; label: string }) {
  const body = "#1d2026";
  const edge = "#3a3f47";
  return (
    <svg viewBox="0 0 120 80" className="art art-camera" role="img" aria-label={label}>
      <defs>
        <radialGradient id="cam-glass" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="#9fd0ff" />
          <stop offset="45%" stopColor="#2c4c8c" />
          <stop offset="100%" stopColor="#0d0a1c" />
        </radialGradient>
      </defs>
      {kind === "mirrorless" && (
        <g>
          <path d="M14 26 h22 l6 -8 h26 l6 8 h32 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 H14 a6 6 0 0 1 -6 -6 V32 a6 6 0 0 1 6 -6 z" fill={body} stroke={edge} />
          <rect x="8" y="30" width="20" height="42" rx="6" fill="#2a2e35" />
          <circle cx="66" cy="49" r="19" fill="#2b3036" />
          <circle cx="66" cy="49" r="14" fill="url(#cam-glass)" />
          <rect x="88" y="20" width="10" height="5" rx="2" fill={edge} />
          <circle cx="20" cy="22" r="4" fill={edge} />
          <circle cx="104" cy="33" r="2.4" fill="var(--tally)" />
        </g>
      )}
      {kind === "action" && (
        <g>
          <rect x="30" y="16" width="62" height="50" rx="9" fill={body} stroke={edge} />
          <rect x="36" y="22" width="22" height="16" rx="3" fill="#0e1014" stroke={edge} />
          <circle cx="74" cy="44" r="13" fill="#2b3036" />
          <circle cx="74" cy="44" r="9" fill="url(#cam-glass)" />
          <rect x="44" y="12" width="14" height="5" rx="2" fill="var(--tally)" />
        </g>
      )}
      {kind === "gimbal" && (
        <g>
          <rect x="50" y="34" width="20" height="42" rx="8" fill={body} stroke={edge} />
          <rect x="54" y="42" width="12" height="16" rx="2" fill="#0e1014" />
          <path d="M60 34 v-6" stroke={edge} strokeWidth="4" />
          <rect x="44" y="8" width="32" height="22" rx="8" fill={body} stroke={edge} />
          <circle cx="60" cy="19" r="8" fill="url(#cam-glass)" />
        </g>
      )}
      {kind === "cam360" && (
        <g>
          <rect x="46" y="8" width="28" height="68" rx="12" fill={body} stroke={edge} />
          <circle cx="60" cy="24" r="12" fill="#2b3036" />
          <circle cx="60" cy="24" r="9" fill="url(#cam-glass)" />
          <rect x="52" y="44" width="16" height="12" rx="2" fill="#0e1014" />
          <circle cx="60" cy="66" r="2.5" fill="var(--tally)" />
        </g>
      )}
      {kind === "drone" && (
        <g>
          {[[22, 22], [98, 22], [22, 62], [98, 62]].map(([x, y], i) => (
            <g key={i}>
              <line x1="60" y1="42" x2={x} y2={y} stroke={edge} strokeWidth="5" strokeLinecap="round" />
              <ellipse cx={x} cy={y} rx="17" ry="4" fill="#5b636e" opacity="0.6" />
              <circle cx={x} cy={y} r="4" fill={body} />
            </g>
          ))}
          <rect x="42" y="30" width="36" height="24" rx="9" fill={body} stroke={edge} />
          <circle cx="60" cy="56" r="7" fill="#2b3036" />
          <circle cx="60" cy="56" r="5" fill="url(#cam-glass)" />
        </g>
      )}
    </svg>
  );
}
