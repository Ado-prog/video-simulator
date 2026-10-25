// Sensor formats and depth-of-field maths (thin-lens model).

export type Sensor = { width: number; height: number }; // mm

export const SENSORS: Record<string, Sensor> = {
  "35mm (full frame)": { width: 36, height: 24 },
  "APS-C": { width: 23.5, height: 15.6 },
  "APS-C (Canon)": { width: 22.3, height: 14.9 },
  "Micro Four Thirds": { width: 17.3, height: 13 },
  "1-inch": { width: 13.2, height: 8.8 },
  "1/1.1-inch": { width: 10.3, height: 10.3 },
  "1/1.3-inch": { width: 9.6, height: 7.2 },
  "1/1.5-inch": { width: 8.5, height: 6.4 },
  "1/2-inch": { width: 6.4, height: 4.8 },
};

export const SENSOR_KEYS = Object.keys(SENSORS);

const diag = (s: Sensor) => Math.hypot(s.width, s.height);

/** Circle of confusion: sensor diagonal / 1500. */
export const cocOf = (s: Sensor) => diag(s) / 1500;

/** Crop factor relative to full frame (43.27 mm diagonal). */
export const cropOf = (s: Sensor) => 43.27 / diag(s);

/** Height of the 16:9 video frame on the sensor. */
export const videoFrameHeight = (s: Sensor) => Math.min(s.height, (s.width * 9) / 16);

export type DepthOfField = {
  hyperfocal: number; // mm
  near: number; // mm
  far: number; // mm, Infinity when beyond hyperfocal
};

/** f, s in mm; N = f-number; c = circle of confusion in mm. */
export function depthOfField(f: number, N: number, s: number, c: number): DepthOfField {
  const H = (f * f) / (N * c) + f;
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s);
  return { hyperfocal: H, near: Math.max(near, 0), far };
}

/** Blur-disc diameter (mm on the sensor) of a point at distance x when focused at s. */
export function blurDisc(f: number, N: number, s: number, x: number) {
  if (s <= f || x <= 0) return 0;
  return (f * f * Math.abs(x - s)) / (N * x * (s - f));
}

/** Common f-stops in third-stop steps. */
export const F_STOPS = [
  0.95, 1, 1.1, 1.2, 1.4, 1.6, 1.7, 1.8, 1.9, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5,
  5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22,
];

export function stopsFrom(min: number) {
  const list = F_STOPS.filter((n) => n > min + 0.001);
  return [Math.round(min * 10) / 10, ...list];
}

export function formatMeters(mm: number) {
  if (!isFinite(mm)) return "∞";
  const m = mm / 1000;
  if (m < 1) return `${Math.round(m * 100)} cm`;
  if (m < 10) return `${m.toFixed(2)} m`;
  if (m < 100) return `${m.toFixed(1)} m`;
  return `${Math.round(m)} m`;
}
