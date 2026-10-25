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
  float32?: boolean; // on-board 32-bit float backup recording
  mine?: boolean; // in Mustafi Studio's kit
};

const TYPE_DEFAULTS: Record<MicType, { sens: number; rejection: number }> = {
  lav: { sens: 0, rejection: 0 },
  oncam: { sens: 4, rejection: 6 },
  boom: { sens: 6, rejection: 8 },
  internal: { sens: -4, rejection: 0 },
};

type Row = [string, string, string, MicType, number, { float32?: boolean; mine?: boolean }?];

const ROWS: Row[] = [
  ["rode-wpro", "RØDE", "Wireless PRO", "lav", 28, { float32: true, mine: true }],
  ["pana-ms2", "Panasonic", "DMW-MS2 (Shotgun)", "oncam", 20, { mine: true }],
  ["rode-wgo3", "RØDE", "Wireless GO (Gen 3)", "lav", 28, { float32: true }],
  ["rode-wme", "RØDE", "Wireless ME", "lav", 29],
  ["rode-vmntg", "RØDE", "VideoMic NTG", "oncam", 15],
  ["rode-vmgo2", "RØDE", "VideoMic GO II", "oncam", 19],
  ["rode-vmicro2", "RØDE", "VideoMicro II", "oncam", 22],
  ["rode-ntg4p", "RØDE", "NTG4+", "boom", 16],
  ["rode-ntg5", "RØDE", "NTG5", "boom", 10],
  ["dji-mic2", "DJI", "Mic 2", "lav", 28, { float32: true }],
  ["dji-micmini", "DJI", "Mic Mini", "lav", 30],
  ["senn-mke600", "Sennheiser", "MKE 600", "oncam", 15],
  ["senn-mke400", "Sennheiser", "MKE 400 (2nd gen)", "oncam", 18],
  ["senn-profile", "Sennheiser", "Profile Wireless", "lav", 29],
  ["senn-ewdp", "Sennheiser", "EW-DP ME 2", "lav", 30],
  ["deity-d3pro", "Deity", "V-Mic D3 Pro", "oncam", 18],
  ["holly-m2", "Hollyland", "Lark M2", "lav", 30],
  ["holly-max", "Hollyland", "Lark Max", "lav", 28],
  ["sony-ecmb10", "Sony", "ECM-B10", "oncam", 20],
  ["sony-ecmb1m", "Sony", "ECM-B1M", "oncam", 19],
  ["canon-dme1d", "Canon", "DM-E1D", "oncam", 21],
  ["nikon-me1", "Nikon", "ME-1", "oncam", 23],
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
