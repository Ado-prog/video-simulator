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
  illu?: boolean; // illustrated people instead of silhouettes
};

// Side-view illustrations (cut out, facing left; the videographer faces right), width / height
const SIDE = {
  couple: { href: "./illustration/side-couple.webp", ar: 545 / 900 },
  groom: { href: "./illustration/side-groom.webp", ar: 175 / 900 },
  man: { href: "./illustration/side-man.webp", ar: 171 / 900 },
  woman: { href: "./illustration/side-woman.webp", ar: 190 / 900 },
  camera: { href: "./illustration/side-camera.webp", ar: 312 / 900 },
};


// Side-profile silhouettes normalised to a height of 1 (feet at y = 0), facing left.
const HEAD = "M0.01 -1 C-0.035 -1 -0.06 -0.978 -0.062 -0.952 L-0.074 -0.926 L-0.063 -0.917 C-0.064 -0.902 -0.057 -0.887 -0.044 -0.882 L-0.028 -0.878 L-0.024 -0.858";
const BACK_HEAD = "L0.022 -0.866 C0.045 -0.89 0.062 -0.94 0.052 -0.972 C0.044 -0.994 0.03 -1 0.01 -1 Z";
const MAN =
  HEAD +
  " C-0.062 -0.845 -0.078 -0.8 -0.074 -0.74 C-0.07 -0.68 -0.064 -0.62 -0.058 -0.56 L-0.052 -0.5" +
  " C-0.056 -0.36 -0.06 -0.2 -0.06 -0.05 L-0.098 -0.022 L-0.102 0 L0.024 0 L0.028 -0.05" +
  " C0.038 -0.2 0.046 -0.36 0.052 -0.5 C0.066 -0.56 0.062 -0.64 0.052 -0.7 C0.046 -0.78 0.052 -0.83 0.032 -0.856 " +
  BACK_HEAD;
const WOMAN =
  HEAD +
  " C-0.058 -0.845 -0.072 -0.8 -0.068 -0.75 C-0.064 -0.7 -0.05 -0.66 -0.046 -0.6 C-0.06 -0.4 -0.11 -0.2 -0.13 0 L0.11 0" +
  " C0.1 -0.2 0.07 -0.4 0.05 -0.56 C0.06 -0.62 0.052 -0.7 0.044 -0.76 C0.042 -0.81 0.05 -0.84 0.03 -0.858 " +
  "L0.03 -0.86 C0.07 -0.86 0.08 -0.8 0.072 -0.74 C0.09 -0.84 0.07 -0.96 0.052 -0.972 C0.044 -0.994 0.03 -1 0.01 -1 Z";
const ARM = "M0.006 -0.83 C-0.02 -0.76 -0.03 -0.68 -0.032 -0.6 C-0.034 -0.56 -0.03 -0.53 -0.024 -0.515 L-0.004 -0.52 C-0.008 -0.56 -0.006 -0.6 0 -0.66 C0.008 -0.72 0.026 -0.78 0.03 -0.82 Z";
// photographer facing right, holding a camera to the eye
const SHOOTER_ARM = "M-0.01 -0.82 C0.03 -0.78 0.07 -0.76 0.1 -0.8 L0.108 -0.86 L0.09 -0.868 L0.082 -0.818 C0.06 -0.8 0.03 -0.81 0.012 -0.84 Z";

const NICE = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 50];
const EYE = 1.5;
const TOP_M = 2.6; // metres shown above the ground

export default function PhotoDiagram(p: Props) {
  const H = 300;
  const W = Math.round(H * p.aspect);
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
  const lensX = x(0) + 15;
  const coneTop = EYE + max * Math.tan(half);
  const coneBottom = EYE - max * Math.tan(half);
  const nearM = p.nearMM / 1000;
  const bandEnd = isFinite(farM) ? x(farM) : x(max);
  const hyperM = p.hyperfocalMM / 1000;

  const step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let m = 0; m <= max + 1e-9; m += step) ticks.push(m);

  // one silhouette per row (two for a couple), side view
  const people: { m: number; h: number; dx: number; dress?: boolean }[] = [];
  if (p.subject === "couple") {
    people.push({ m: p.focusM, h: 1.82, dx: -6 }, { m: p.focusM, h: 1.66, dx: 8, dress: true });
  } else if (p.subject === "person") {
    people.push({ m: p.focusM, h: 1.78, dx: 0 });
  } else {
    for (let r = 0; r < rows; r++) people.push({ m: p.focusM + r * ROW_GAP, h: r % 2 ? 1.66 : 1.8, dx: 0, dress: r % 2 === 1 });
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

        {p.illu &&
          (() => {
            // one picture per row; the couple is a single picture
            const list =
              p.subject === "couple"
                ? [{ m: p.focusM, h: 1.84, pic: SIDE.couple }]
                : p.subject === "person"
                ? [{ m: p.focusM, h: 1.82, pic: SIDE.groom }]
                : people.map((pp) => ({ m: pp.m, h: pp.h + 0.03, pic: pp.dress ? SIDE.woman : SIDE.man }));
            return list.map((it, i) => {
              const hPx = it.h * vs;
              const wPx = hPx * it.pic.ar;
              const inside = it.m * 1000 >= p.nearMM - 1 && it.m * 1000 <= p.farMM + 1;
              return (
                <image key={i} href={it.pic.href} x={x(it.m) - wPx * 0.35} y={groundY - hPx} width={wPx} height={hPx} opacity={inside ? 1 : 0.45} />
              );
            });
          })()}
        {!p.illu && people.map((pp, i) => {
          const px = pp.h * vs; // silhouettes scale with real height
          const inside = pp.m * 1000 >= p.nearMM - 1 && pp.m * 1000 <= p.farMM + 1;
          const woman = pp.dress;
          return (
            <g key={i} className={inside ? "d-person" : "d-person d-person-soft"} transform={`translate(${x(pp.m) + pp.dx} ${groundY}) scale(${px})`}>
              <path d={woman ? WOMAN : MAN} />
              <path d={ARM} className="d-arm" />
            </g>
          );
        })}

        {/* photographer, camera at eye level */}
        {p.illu ? (
          (() => {
            const hPx = 1.72 * vs;
            const wPx = hPx * SIDE.camera.ar;
            return <image href={SIDE.camera.href} x={lensX - wPx} y={groundY - hPx} width={wPx} height={hPx} />;
          })()
        ) : (() => {
          const ph = 1.62 * vs;
          return (
            <g className="d-shooter" transform={`translate(${x(0) - 4} ${groundY}) scale(${-ph} ${ph})`}>
              <path d={MAN} />
              <path d={SHOOTER_ARM} transform="scale(-1 1)" className="d-arm" />
            </g>
          );
        })()}
        {!p.illu && <rect x={x(0) - 2} y={y(EYE) - 6} width={12} height={10} rx={2} className="d-cam-body" />}
        {!p.illu && <rect x={x(0) + 9} y={y(EYE) - 3.5} width={6} height={6} rx={1} className="d-cam-body" />}

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
