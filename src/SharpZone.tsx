import { formatMeters } from "./optics";

type Props = {
  focusM: number;
  nearMM: number;
  farMM: number;
  hyperfocalMM: number;
  label: string;
};

const NICE = [2, 3, 5, 8, 10, 15, 20, 30, 50];

/** Side view of where the image is acceptably sharp, from the camera outwards. */
export default function SharpZone({ focusM, nearMM, farMM, hyperfocalMM, label }: Props) {
  const farM = isFinite(farMM) ? farMM / 1000 : Infinity;
  const want = Math.max(focusM * 2.2, isFinite(farM) ? farM * 1.15 : focusM * 2.5);
  const max = NICE.find((n) => n >= want) ?? 50;
  const W = 600;
  const PAD = 18;
  const x = (m: number) => PAD + (Math.min(m, max) / max) * (W - PAD * 2);
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let m = 0; m <= max + 1e-9; m += step) ticks.push(m);
  const nearM = nearMM / 1000;
  const bandEnd = isFinite(farM) ? x(farM) : W - PAD;
  const hyperM = hyperfocalMM / 1000;

  return (
    <div className="zone">
      <div className="zone-head">
        <span className="eyebrow">{label}</span>
        <span className="zone-range">
          {formatMeters(nearMM)} – {formatMeters(farMM)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} 58`} className="zone-svg" role="img" aria-label={label}>
        <line x1={PAD} y1={30} x2={W - PAD} y2={30} className="zone-axis" />
        <rect x={x(nearM)} y={20} width={Math.max(bandEnd - x(nearM), 2)} height={20} rx={3} className="zone-band" />
        {!isFinite(farM) && <path d={`M${W - PAD - 2} 24 l8 6 l-8 6 z`} className="zone-arrow" />}
        {hyperM <= max && <line x1={x(hyperM)} y1={14} x2={x(hyperM)} y2={46} className="zone-hyper" />}
        <line x1={x(focusM)} y1={10} x2={x(focusM)} y2={46} className="zone-focus" />
        <circle cx={x(focusM)} cy={10} r={3.5} className="zone-focus-dot" />
        <rect x={PAD - 10} y={24} width={12} height={12} rx={2} className="zone-cam" />
        {ticks.map((m) => (
          <g key={m}>
            <line x1={x(m)} y1={40} x2={x(m)} y2={44} className="zone-tick" />
            <text x={x(m)} y={55} textAnchor="middle" className="zone-label">
              {m} m
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
