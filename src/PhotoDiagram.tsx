import { formatMeters } from "./optics";
import { ROW_GAP, rowCount, type SubjectKind } from "./Monitor";

// Side view of the scene for photo mode: camera, angle of view, focus plane and the sharp zone.
// Distances run left to right; heights use their own (larger) scale so people stay readable.

type Props = {
  focal: number;
  aperture: number;
  focusM: number;
  nearMM: number;
  farMM: number;
  hyperfocalMM: number;
  sensorHeightMM: number;
  subject: SubjectKind;
  aspect: number; // match the monitor's shape
  label: string;
  nearLabel: string;
  farLabel: string;
};

const NICE = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 50];
const EYE = 1.5;
const TOP_M = 2.6; // metres shown above the ground

export default function PhotoDiagram(p: Props) {
  const W = 480;
  const H = Math.round(W / p.aspect);
  const padL = 30;
  const padR = 14;
  const groundY = H - 34;
  const vs = (groundY - 26) / TOP_M; // px per metre, vertical
  const rows = rowCount(p.subject);
  const lastRow = p.focusM + (rows - 1) * ROW_GAP;
  const farM = isFinite(p.farMM) ? p.farMM / 1000 : Infinity;
  const want = Math.max(lastRow * 1.6, p.focusM * 2.2, isFinite(farM) ? farM * 1.12 : 0, 2);
  const max = NICE.find((n) => n >= want) ?? 50;
  const hs = (W - padL - padR) / max; // px per metre, horizontal
  const x = (m: number) => padL + Math.min(Math.max(m, 0), max) * hs;
  const y = (h: number) => groundY - h * vs;

  const half = Math.atan(p.sensorHeightMM / 2 / p.focal);
  const lensX = x(0) + 7;
  const coneTop = EYE + max * Math.tan(half);
  const coneBottom = EYE - max * Math.tan(half);
  const nearM = p.nearMM / 1000;
  const bandEnd = isFinite(farM) ? x(farM) : x(max);
  const hyperM = p.hyperfocalMM / 1000;

  const step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let m = 0; m <= max + 1e-9; m += step) ticks.push(m);

  // one silhouette per row (two for a couple), side view
  const people: { m: number; h: number; dx: number }[] = [];
  if (p.subject === "couple") {
    people.push({ m: p.focusM, h: 1.82, dx: -5 }, { m: p.focusM, h: 1.66, dx: 6 });
  } else if (p.subject === "person") {
    people.push({ m: p.focusM, h: 1.78, dx: 0 });
  } else {
    for (let r = 0; r < rows; r++) people.push({ m: p.focusM + r * ROW_GAP, h: 1.74 + (r % 2) * 0.06, dx: 0 });
  }

  return (
    <figure className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.label} className="diagram-svg">
        <defs>
          <clipPath id="d-air">
            <rect x={padL} y={y(TOP_M)} width={W - padL - padR} height={groundY - y(TOP_M)} />
          </clipPath>
        </defs>

        <rect x={0} y={0} width={W} height={H} className="d-bg" />
        <rect x={padL} y={groundY} width={W - padL - padR} height={4} className="d-ground" />

        <g clipPath="url(#d-air)">
          <rect x={x(nearM)} y={y(TOP_M)} width={Math.max(bandEnd - x(nearM), 1.5)} height={groundY - y(TOP_M)} className="d-band" />
          <polygon
            points={`${lensX},${y(EYE)} ${x(max)},${y(coneTop)} ${x(max)},${y(coneBottom)}`}
            className="d-cone"
          />
          <line x1={lensX} y1={y(EYE)} x2={x(max)} y2={y(coneTop)} className="d-cone-edge" />
          <line x1={lensX} y1={y(EYE)} x2={x(max)} y2={y(coneBottom)} className="d-cone-edge" />
        </g>

        {hyperM <= max && (
          <g>
            <line x1={x(hyperM)} y1={y(TOP_M)} x2={x(hyperM)} y2={groundY} className="d-hyper" />
            <text x={x(hyperM) + 3} y={y(TOP_M) + 9} className="d-small">H</text>
          </g>
        )}
        <line x1={x(p.focusM)} y1={y(TOP_M) - 4} x2={x(p.focusM)} y2={groundY} className="d-focus" />

        {people.map((pp, i) => {
          const cx = x(pp.m) + pp.dx;
          const top = y(pp.h);
          const headR = Math.max(3.2, 0.11 * vs);
          const bodyTop = top + headR * 2 + 1;
          const hip = y(pp.h * 0.5);
          const inside = pp.m * 1000 >= p.nearMM - 1 && pp.m * 1000 <= p.farMM + 1;
          return (
            <g key={i} className={inside ? "d-person" : "d-person d-person-soft"}>
              <circle cx={cx} cy={top + headR} r={headR} />
              <rect x={cx - headR * 0.9} y={bodyTop} width={headR * 1.8} height={hip - bodyTop} rx={headR * 0.6} />
              <rect x={cx - headR * 0.75} y={hip} width={headR * 0.65} height={groundY - hip} rx={1} />
              <rect x={cx + headR * 0.1} y={hip} width={headR * 0.65} height={groundY - hip} rx={1} />
            </g>
          );
        })}

        {/* camera on a tripod */}
        <g className="d-cam">
          <line x1={x(0)} y1={y(EYE) + 6} x2={x(0) - 8} y2={groundY} />
          <line x1={x(0)} y1={y(EYE) + 6} x2={x(0) + 8} y2={groundY} />
          <rect x={x(0) - 9} y={y(EYE) - 6} width={14} height={11} rx={2} />
          <rect x={x(0) + 4} y={y(EYE) - 3.5} width={5} height={6} rx={1} />
        </g>

        <text x={padL + 2} y={16} className="d-title">
          {Math.round(p.focal * 10) / 10} mm · f/{p.aperture}
        </text>
        <text x={x(nearM)} y={y(TOP_M) - 6} textAnchor="middle" className="d-small">
          {p.nearLabel} {formatMeters(p.nearMM)}
        </text>
        <text x={Math.min(bandEnd, W - padR - 40)} y={y(TOP_M) + 18} textAnchor="middle" className="d-small">
          {p.farLabel} {formatMeters(p.farMM)}
        </text>

        {ticks.map((m) => (
          <g key={m}>
            <line x1={x(m)} y1={groundY + 4} x2={x(m)} y2={groundY + 9} className="d-tick" />
            <text x={x(m)} y={groundY + 21} textAnchor="middle" className="d-small">{m} m</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
