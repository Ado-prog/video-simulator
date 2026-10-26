// Extra camera facts for the assist tools. Values are typical, rounded and approximate.

import type { Camera } from "./gear";

type Facts = {
  mp: number; // megapixels
  readout: number; // ms, full-width video readout (0 = global shutter)
  dualIso?: number[]; // native (base) ISOs in Log, two or three
  sync?: number; // flash sync speed in s (undefined = no hot-shoe flash)
  openGate?: boolean;
  k8?: boolean;
  k6?: boolean;
  maxFps: number; // highest frame rate in 4K
  frames?: number; // frame markers shown at once (default 1)
};

const F: Record<string, Facts> = {
  "pana-s1ii": { mp: 24, readout: 11, dualIso: [640, 4000], sync: 1 / 250, openGate: true, k6: true, maxFps: 120, frames: 3 },
  "pana-s1rii": { mp: 44, readout: 15, dualIso: [640, 4000], sync: 1 / 250, openGate: true, k8: true, k6: true, maxFps: 120, frames: 3 },
  "pana-s1h": { mp: 24, readout: 21, dualIso: [640, 4000], sync: 1 / 320, k6: true, maxFps: 60 },
  "pana-s5ii": { mp: 24, readout: 22, dualIso: [640, 4000], sync: 1 / 250, openGate: true, k6: true, maxFps: 60, frames: 3 },
  "pana-s5iix": { mp: 24, readout: 22, dualIso: [640, 4000], sync: 1 / 250, openGate: true, k6: true, maxFps: 60, frames: 3 },
  "pana-s5": { mp: 24, readout: 22, dualIso: [640, 4000], sync: 1 / 200, maxFps: 60 },
  "pana-s9": { mp: 24, readout: 22, dualIso: [640, 4000], openGate: true, k6: true, maxFps: 60 },
  "pana-gh7": { mp: 25, readout: 11, dualIso: [500, 2000], sync: 1 / 250, openGate: true, k6: true, maxFps: 120, frames: 3 },
  "pana-gh6": { mp: 25, readout: 12, sync: 1 / 250, openGate: true, k6: true, maxFps: 120 },
  "pana-g9ii": { mp: 25, readout: 12, dualIso: [500, 2000], sync: 1 / 250, openGate: true, k6: true, maxFps: 120, frames: 3 },
  "sony-a1ii": { mp: 50, readout: 4, sync: 1 / 400, k8: true, maxFps: 120 },
  "sony-a9iii": { mp: 24, readout: 0, sync: 1 / 80000, maxFps: 120 },
  "sony-a7rv": { mp: 61, readout: 16, sync: 1 / 250, k8: true, maxFps: 60 },
  "sony-a7iv": { mp: 33, readout: 27, sync: 1 / 250, maxFps: 60 },
  "sony-a7siii": { mp: 12, readout: 9, dualIso: [640, 12800], sync: 1 / 250, maxFps: 120 },
  "sony-a7cii": { mp: 33, readout: 27, sync: 1 / 160, maxFps: 60 },
  "sony-fx5": { mp: 16.6, readout: 4, dualIso: [800, 4000, 12800], openGate: true, maxFps: 120 },
  "sony-fx2": { mp: 33, readout: 22, dualIso: [800, 4000], openGate: true, maxFps: 60 },
  "sony-fx3": { mp: 12, readout: 9, dualIso: [640, 12800], maxFps: 120 },
  "sony-zve1": { mp: 12, readout: 9, dualIso: [640, 12800], maxFps: 120 },
  "sony-a6700": { mp: 26, readout: 20, sync: 1 / 160, maxFps: 120 },
  "sony-fx30": { mp: 26, readout: 20, dualIso: [800, 2500], maxFps: 120 },
  "sony-zve10ii": { mp: 26, readout: 25, maxFps: 60 },
  "canon-r1": { mp: 24, readout: 6, sync: 1 / 250, k6: true, maxFps: 120 },
  "canon-r3": { mp: 24, readout: 8, sync: 1 / 250, k6: true, maxFps: 120 },
  "canon-r5ii": { mp: 45, readout: 9, sync: 1 / 250, k8: true, maxFps: 120 },
  "canon-r6ii": { mp: 24, readout: 15, sync: 1 / 250, maxFps: 60 },
  "canon-r8": { mp: 24, readout: 15, sync: 1 / 200, maxFps: 60 },
  "canon-r7": { mp: 32.5, readout: 26, sync: 1 / 250, maxFps: 60 },
  "canon-r10": { mp: 24, readout: 27, sync: 1 / 250, maxFps: 60 },
  "canon-r50": { mp: 24, readout: 30, sync: 1 / 200, maxFps: 30 },
  "nikon-z9": { mp: 45, readout: 4, sync: 1 / 200, k8: true, maxFps: 120 },
  "nikon-z8": { mp: 45, readout: 4, sync: 1 / 200, k8: true, maxFps: 120 },
  "nikon-z6iii": { mp: 24.5, readout: 14, sync: 1 / 200, k6: true, maxFps: 120 },
  "nikon-zf": { mp: 24.5, readout: 22, sync: 1 / 200, maxFps: 60 },
  "nikon-z5ii": { mp: 24.5, readout: 22, sync: 1 / 200, maxFps: 60 },
  "nikon-z50ii": { mp: 21, readout: 25, sync: 1 / 200, maxFps: 60 },
  "nikon-zfc": { mp: 21, readout: 25, sync: 1 / 200, maxFps: 30 },
  "dji-pocket3": { mp: 9.4, readout: 12, maxFps: 120 },
  "dji-action5": { mp: 40, readout: 12, maxFps: 120 },
  "dji-action4": { mp: 10, readout: 12, maxFps: 120 },
  "dji-nano": { mp: 10, readout: 12, maxFps: 120 },
  "dji-osmo360": { mp: 30, readout: 15, maxFps: 60 },
  "dji-avata360": { mp: 30, readout: 15, maxFps: 60 },
  "dji-avata2": { mp: 12, readout: 15, maxFps: 100 },
  "dji-neo": { mp: 12, readout: 18, maxFps: 30 },
  "dji-mini4pro": { mp: 48, readout: 15, maxFps: 100 },
  "dji-mini5pro": { mp: 50, readout: 14, maxFps: 120 },
  "dji-air3s": { mp: 50, readout: 14, maxFps: 120 },
  "dji-mavic4pro": { mp: 100, readout: 14, k6: true, maxFps: 120 },
  "dji-mavic3pro": { mp: 20, readout: 15, maxFps: 120 },
  "insta-x6": { mp: 72, readout: 15, maxFps: 60 },
  "insta-x5": { mp: 72, readout: 15, maxFps: 60 },
  "insta-x4": { mp: 72, readout: 18, maxFps: 60 },
  "insta-x3": { mp: 72, readout: 20, maxFps: 30 },
};

const GENERIC: Facts = { mp: 24, readout: 20, sync: 1 / 250, maxFps: 60 };

export function factsFor(cam: Camera | undefined): Facts {
  return (cam && F[cam.id]) || GENERIC;
}

/** Typical dynamic range in stops per sensor size (base ISO, Log adds about one stop of usable range). */
export function sensorDR(sensorKey: string) {
  if (sensorKey.startsWith("35mm")) return 14;
  if (sensorKey.startsWith("APS-C")) return 13.5;
  if (sensorKey === "Micro Four Thirds") return 12.5;
  if (sensorKey === "1-inch" || sensorKey === "1/1.1-inch") return 12;
  return 11;
}

/** Contrast of each light scene in stops (brightest highlight to darkest detail). */
export const SCENE_DR: Record<string, number> = {
  summer: 14, spring: 13, autumn: 12, winter: 15, overcast: 10,
  golden: 15, blue: 13, night: 16, hall: 12, disco: 15,
};

/** Pixel pitch in µm. */
export function pixelPitch(sensorWidthMM: number, sensorHeightMM: number, mp: number) {
  return (sensorWidthMM * 1000) / Math.sqrt((mp * 1e6 * sensorWidthMM) / sensorHeightMM);
}

/** DJI Ronin gimbals: payload in kg. */
export const RONINS = [
  { id: "rs4mini", name: "DJI RS 4 Mini", payload: 2 },
  { id: "rs4", name: "DJI RS 4", payload: 3 },
  { id: "rs4pro", name: "DJI RS 4 Pro", payload: 4.5 },
  { id: "rs3mini", name: "DJI RS 3 Mini", payload: 2 },
  { id: "rs3pro", name: "DJI RS 3 Pro", payload: 4.5 },
] as const;
export type RoninId = (typeof RONINS)[number]["id"];

/** Gimbal follow modes and how fast the picture typically turns (degrees per second). */
export const RONIN_MODES = { lock: 3, pf: 20, ptf: 20, fpv: 45 } as const;
export type RoninMode = keyof typeof RONIN_MODES;
