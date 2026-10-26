// Microphones and a simple recording-level model.
// Self-noise and sensitivity values are typical figures, rounded and approximate.

export type MicType = "lav" | "oncam" | "boom" | "internal";

export type Mic = {
  id: string;
  brand: string;
  name: string;
  type: MicType;
  selfNoise: number; // dB(A)
  sens: number; // relative output in dB (0 = typical lav)
  rejection: number; // dB less room sound thanks to directivity
  float32?: boolean; // 32-bit float recording (switchable)
  f32cam?: boolean; // 32-bit float goes into the camera, not a transmitter
  pat?: PatternId[]; // switchable pickup patterns, first = default
  nc?: "nc" | "wind"; // noise / wind-noise cancelling
  safety?: number; // safety track level in dB (negative)
  onboard?: boolean; // onboard recording in the transmitter
  mine?: boolean; // in Mustafi Studio's kit
};

/** Pickup patterns: dB more/less room rejection and on-axis level vs. the mic's default. */
export const PATTERNS = {
  sc: { rej: 0, sens: 0 },
  shot: { rej: 0, sens: 0 },
  card: { rej: -3, sens: 0 },
  omni: { rej: -6, sens: 0 },
  stereo: { rej: -6, sens: 0 },
  st90: { rej: -5, sens: 0 },
  st120: { rej: -7, sens: 0 },
  rear: { rej: 0, sens: -15 }, // picks up behind the camera, subject in front gets quieter
  bi: { rej: -3, sens: 0 },
} as const;
export type PatternId = keyof typeof PATTERNS;

type Features = Pick<Mic, "float32" | "f32cam" | "pat" | "nc" | "safety" | "onboard" | "mine">;

const TYPE_DEFAULTS: Record<MicType, { sens: number; rejection: number }> = {
  lav: { sens: 0, rejection: 0 },
  oncam: { sens: 4, rejection: 6 },
  boom: { sens: 6, rejection: 8 },
  internal: { sens: -4, rejection: 0 },
};

type Row = [string, string, string, MicType, number, Features?];

const ROWS: Row[] = [
  ["rode-wpro", "RØDE", "Wireless PRO", "lav", 28, { float32: true, safety: -20, onboard: true, mine: true }],
  ["pana-dms1", "Panasonic", "DMW-DMS1E (Digital Shotgun)", "oncam", 16, {
    float32: true, f32cam: true, pat: ["sc", "card", "st90", "st120", "rear", "bi"], nc: "wind", safety: -20, mine: true,
  }],
  ["pana-ms2", "Panasonic", "DMW-MS2 (Shotgun)", "oncam", 20, { pat: ["shot", "stereo"], mine: true }],
  ["rode-wgo3", "RØDE", "Wireless GO (Gen 3)", "lav", 28, { float32: true, safety: -20, onboard: true }],
  ["rode-wme", "RØDE", "Wireless ME", "lav", 29, { onboard: true }],
  ["rode-vmntg", "RØDE", "VideoMic NTG", "oncam", 15, { safety: -20 }],
  ["rode-vmgo2", "RØDE", "VideoMic GO II", "oncam", 19],
  ["rode-vmicro2", "RØDE", "VideoMicro II", "oncam", 22],
  ["rode-ntg4p", "RØDE", "NTG4+", "boom", 16],
  ["rode-ntg5", "RØDE", "NTG5", "boom", 10],
  ["dji-mic2", "DJI", "Mic 2", "lav", 28, { float32: true, nc: "nc", safety: -6, onboard: true }],
  ["dji-micmini", "DJI", "Mic Mini", "lav", 30, { nc: "nc" }],
  ["senn-mke600", "Sennheiser", "MKE 600", "oncam", 15],
  ["senn-mke400", "Sennheiser", "MKE 400 (2nd gen)", "oncam", 18],
  ["senn-profile", "Sennheiser", "Profile Wireless", "lav", 29, { onboard: true }],
  ["senn-ewdp", "Sennheiser", "EW-DP ME 2", "lav", 30],
  ["deity-d3pro", "Deity", "V-Mic D3 Pro", "oncam", 18],
  ["holly-m2", "Hollyland", "Lark M2", "lav", 30, { nc: "nc" }],
  ["holly-max", "Hollyland", "Lark Max", "lav", 28, { nc: "nc", safety: -6, onboard: true }],
  ["sony-ecmb10", "Sony", "ECM-B10", "oncam", 20, { pat: ["sc", "card", "omni"] }],
  ["sony-ecmb1m", "Sony", "ECM-B1M", "oncam", 19, { pat: ["sc", "card", "omni"] }],
  ["canon-dme1d", "Canon", "DM-E1D", "oncam", 21, { pat: ["shot", "st90", "st120"] }],
  ["nikon-me1", "Nikon", "ME-1", "oncam", 23],
  // more wireless and recorder systems
  ["dji-mic3", "DJI", "Mic 3", "lav", 28, { float32: true, nc: "nc", onboard: true }],
  ["dji-mic1", "DJI", "Mic (1st gen)", "lav", 30, { onboard: true }],
  ["rode-wgo2", "RØDE", "Wireless GO II", "lav", 30, { safety: -20, onboard: true }],
  ["rode-wmicro", "RØDE", "Wireless Micro", "lav", 30],
  ["rode-vmproplus", "RØDE", "VideoMic Pro+", "oncam", 14],
  ["senn-mke200", "Sennheiser", "MKE 200", "oncam", 22],
  ["holly-m1", "Hollyland", "Lark M1", "lav", 30, { nc: "nc" }],
  ["holly-m2s", "Hollyland", "Lark M2S", "lav", 30, { nc: "nc" }],
  ["holly-c1", "Hollyland", "Lark C1", "lav", 30, { nc: "nc" }],
  ["sara-ultra", "Saramonic", "Ultra", "lav", 28, { float32: true, nc: "nc", onboard: true }],
  ["sara-blink500", "Saramonic", "Blink500 B2+", "lav", 30],
  ["deity-theos", "Deity", "THEOS Digital Wireless", "lav", 28, { float32: true, onboard: true }],
  ["zoom-f2", "Zoom", "F2 (Lav-Recorder)", "lav", 27, { float32: true, onboard: true }],
  ["tascam-dr10l", "Tascam", "DR-10L Pro (Lav-Recorder)", "lav", 27, { float32: true, onboard: true }],
  ["shure-movemic", "Shure", "MoveMic", "lav", 29],
  ["sony-ecmw3", "Sony", "ECM-W3", "lav", 30, { nc: "nc" }],
  ["comica-vimo", "Comica", "Vimo C", "lav", 30, { nc: "nc" }],
];

export const MICS: Mic[] = ROWS.map(([id, brand, name, type, selfNoise, extra]) => ({
  id,
  brand,
  name,
  type,
  selfNoise,
  ...TYPE_DEFAULTS[type],
  ...extra,
}));

export const INTERNAL_MIC: Mic = {
  id: "internal",
  brand: "",
  name: "",
  type: "internal",
  selfNoise: 32,
  ...TYPE_DEFAULTS.internal,
};

export const MIC_BRANDS = [...new Set(MICS.filter((m) => !m.mine).map((m) => m.brand))];

export const SOURCES = {
  speech: { spl: 60, crest: 12, speech: true },
  vows: { spl: 50, crest: 12, speech: true },
  toast: { spl: 68, crest: 14, speech: true },
  band: { spl: 100, crest: 8, speech: false },
  applause: { spl: 88, crest: 6, speech: false },
} as const;
export type SourceId = keyof typeof SOURCES;

/** Background sound level (dB SPL) of each light scene. */
const AMBIENT: Record<string, number> = {
  summer: 45, spring: 42, autumn: 42, winter: 38, overcast: 44,
  golden: 42, blue: 40, night: 38, hall: 52, disco: 88,
};

const sumDb = (...values: number[]) => 10 * Math.log10(values.reduce((s, v) => s + Math.pow(10, v / 10), 0));

export type AudioInput = {
  mic: Mic;
  source: SourceId;
  sceneId: string;
  outdoor: boolean;
  cameraDistanceM: number;
  gain: number; // dB
  limiter: boolean;
  lowCut: boolean;
  float32?: boolean; // 32-bit float switched on (and supported)
};

export type AudioResult = {
  distanceM: number;
  avg: number; // dBFS
  peak: number; // dBFS after limiter
  rawPeak: number; // dBFS before limiter
  noiseFloor: number; // dBFS
  clip: boolean;
  limiting: boolean;
  overdriven: boolean;
  snr: number | null; // speech over room sound, dB
  f32over?: boolean; // above 0 dBFS but safe in the 32-bit float file
};

export function micDistance(mic: Mic, source: SourceId, cameraDistanceM: number) {
  const base =
    mic.type === "lav" ? 0.2 : mic.type === "boom" ? 0.8 : Math.max(cameraDistanceM, 0.3);
  if (source === "band") return Math.max(base, 4);
  if (source === "applause") return Math.max(base, 5);
  return base;
}

/** Level that reaches the recorder (calibrated so speech on a lav at gain 0 is about −20 dBFS). */
export function audioLevels(a: AudioInput): AudioResult {
  const src = SOURCES[a.source];
  const distanceM = micDistance(a.mic, a.source, a.cameraDistanceM);
  const toDbfs = (spl: number) => spl - 94 + a.mic.sens + a.gain;

  const srcLevel = toDbfs(src.spl - 20 * Math.log10(distanceM));
  const wind = a.outdoor ? 52 - (a.lowCut ? 10 : 0) - (a.mic.type === "lav" ? 6 : 0) : -100;
  const room = sumDb(AMBIENT[a.sceneId] ?? 45, wind) - a.mic.rejection;
  const roomLevel = toDbfs(room);
  const noiseFloor = sumDb(toDbfs(a.mic.selfNoise), roomLevel);
  const avg = sumDb(srcLevel, roomLevel);
  const rawPeak = avg + src.crest;
  const ceiling = -2;
  const limiting = a.limiter && rawPeak > ceiling;
  const peak = a.limiter ? Math.min(rawPeak, ceiling) : Math.min(rawPeak, 0);
  if (a.float32 && !a.limiter) {
    // 32-bit float: nothing clips, the level can simply be lowered in post
    return { distanceM, avg, peak: rawPeak, rawPeak, noiseFloor, clip: false, limiting: false, overdriven: false,
      snr: src.speech ? srcLevel - roomLevel : null, f32over: rawPeak > 0 };
  }
  return {
    distanceM,
    avg: a.limiter ? Math.min(avg, ceiling - 4) : Math.min(avg, 0),
    peak,
    rawPeak,
    noiseFloor,
    clip: !a.limiter && rawPeak > 0,
    limiting,
    overdriven: a.limiter && rawPeak > 10,
    snr: src.speech ? srcLevel - roomLevel : null,
  };
}

/** Gain that puts the average level near −18 dBFS. */
export function autoGain(a: Omit<AudioInput, "gain" | "limiter">) {
  const probe = audioLevels({ ...a, gain: 0, limiter: false });
  return Math.max(-12, Math.min(30, Math.round(-18 - probe.avg)));
}

/** The mic as it behaves with the chosen pattern and noise cancelling. */
export function effectiveMic(mic: Mic, pattern: PatternId | null, nc: boolean): Mic {
  const p = pattern ? PATTERNS[pattern] : { rej: 0, sens: 0 };
  return { ...mic, sens: mic.sens + p.sens, rejection: mic.rejection + p.rej + (mic.nc && nc ? 8 : 0) };
}
