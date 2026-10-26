// Picture profiles (standard) and monitoring LUTs (Log) per camera.
// The looks are approximate previews of each style, not exact colour science.

import type { Camera } from "./gear";

/** How a style changes the Rec.709 picture on the monitor. */
export type Look = {
  sat: number; // saturation multiplier
  contrast: number; // slope around mid grey
  lift?: number; // raised blacks (0–0.1)
  warm?: number; // + warmer, − cooler
  teal?: number; // teal shadows / orange skin amount
  mono?: boolean;
};

export type Style = { id: string; name: string; look: Look };

export const NEUTRAL_LOOK: Look = { sat: 1, contrast: 1 };

const st = (name: string, look: Look): Style => ({ id: name, name, look });

const S = {
  standard: { sat: 1, contrast: 1 },
  vivid: { sat: 1.35, contrast: 1.12 },
  natural: { sat: 0.92, contrast: 0.94 },
  neutral: { sat: 0.85, contrast: 0.9 },
  flat: { sat: 0.72, contrast: 0.78, lift: 0.05 },
  portrait: { sat: 0.95, contrast: 0.95, warm: 0.03 },
  landscape: { sat: 1.25, contrast: 1.08, warm: -0.02 },
  mono: { sat: 0, contrast: 1.05, mono: true },
  monoHard: { sat: 0, contrast: 1.25, mono: true },
  monoSoft: { sat: 0, contrast: 0.85, lift: 0.04, mono: true },
  cinelikeD: { sat: 0.88, contrast: 0.82, lift: 0.03 },
  cinelikeV: { sat: 1.05, contrast: 1.1 },
  like709: { sat: 0.95, contrast: 0.9 },
  classicNeo: { sat: 0.8, contrast: 0.92, lift: 0.04, warm: 0.04 },
  cinetone: { sat: 0.92, contrast: 0.9, warm: 0.02, lift: 0.02 },
  faithful: { sat: 0.9, contrast: 0.92 },
  richPortrait: { sat: 0.9, contrast: 0.96, warm: 0.04, lift: 0.02 },
} satisfies Record<string, Look>;

const PANA_NEW = ["pana-s1ii", "pana-s1rii", "pana-s5ii", "pana-s5iix", "pana-s9", "pana-gh7", "pana-g9ii"];
const DJI_HLG = ["dji-pocket3", "dji-action5", "dji-mini4pro", "dji-mini5pro", "dji-air3s", "dji-mavic3pro", "dji-mavic4pro"];

/** Picture profiles available in the camera (Rec.709 output). The first one is the default. */
export function stylesFor(cam: Camera | undefined): Style[] {
  if (!cam) return [st("Standard", S.standard), st("Neutral", S.neutral), st("Vivid", S.vivid), st("Flat", S.flat), st("Monochrome", S.mono)];
  switch (cam.brand) {
    case "Panasonic": {
      const base = [
        st("Standard", S.standard), st("Vivid", S.vivid), st("Natural", S.natural), st("Flat", S.flat),
        st("Landscape", S.landscape), st("Portrait", S.portrait), st("Monochrome", S.mono),
        st("L.Monochrome", S.monoHard), st("Cinelike D2", S.cinelikeD), st("Cinelike V2", S.cinelikeV), st("Like709", S.like709),
      ];
      return PANA_NEW.includes(cam.id)
        ? [...base, st("L.ClassicNeo", S.classicNeo), st("Leica Monochrome", S.monoSoft)]
        : base;
    }
    case "Sony":
      return [
        st("ST (Standard)", S.standard), st("PT (Portrait)", S.portrait), st("NT (Neutral)", S.neutral),
        st("VV (Vivid)", S.vivid), st("VV2 (Vivid 2)", { sat: 1.3, contrast: 1.05 }), st("FL (Film)", { sat: 0.85, contrast: 0.95, teal: 0.4 }),
        st("IN (Instant)", { sat: 0.8, contrast: 0.85, lift: 0.04, warm: 0.03 }), st("SH (Soft High-key)", { sat: 0.85, contrast: 0.8, lift: 0.08 }),
        st("BW (Black & White)", S.mono), st("SE (Sepia)", { sat: 0.25, contrast: 1, warm: 0.12 }), st("S-Cinetone", S.cinetone),
      ];
    case "Canon":
      return [
        st("Auto", S.standard), st("Standard", S.standard), st("Portrait", S.portrait), st("Landscape", S.landscape),
        st("Fine Detail", { sat: 1, contrast: 1.04 }), st("Neutral", S.neutral), st("Faithful", S.faithful), st("Monochrome", S.mono),
      ];
    case "Nikon": {
      const list = [
        st("Auto", S.standard), st("Standard", S.standard), st("Neutral", S.neutral), st("Vivid", S.vivid),
        st("Monochrome", S.mono), st("Portrait", S.portrait), st("Landscape", S.landscape), st("Flat", S.flat),
      ];
      return cam.id === "nikon-zfc"
        ? list
        : [...list, st("Rich Tone Portrait", S.richPortrait), st("Flat Monochrome", S.monoSoft), st("Deep Tone Monochrome", S.monoHard)];
    }
    case "DJI":
      return DJI_HLG.includes(cam.id) ? [st("Normal", S.standard), st("HLG", { sat: 1.05, contrast: 0.95 })] : [st("Normal", S.standard)];
    case "Insta360":
      return [st("Standard", S.standard), st("Vivid", S.vivid)];
  }
  return [st("Standard", S.standard)];
}

/** Creative monitoring LUTs offered for every Log profile (names come from i18n). */
export const CREATIVE_LUTS = [
  { id: "cr_warm", look: { sat: 0.95, contrast: 1, warm: 0.07, lift: 0.02 } },
  { id: "cr_teal", look: { sat: 1.05, contrast: 1.05, teal: 1 } },
  { id: "cr_film", look: { sat: 0.85, contrast: 0.92, lift: 0.04, warm: 0.03, teal: 0.3 } },
  { id: "cr_bw", look: { sat: 0, contrast: 1.1, mono: true } },
] as const;
export type CreativeLutId = (typeof CREATIVE_LUTS)[number]["id"];

/** The manufacturer's Log → Rec.709 conversion LUTs for a Log profile. */
export function makerLutsFor(logName: string): Style[] {
  switch (logName) {
    case "V-Log":
      return [st("V-Log → V-709 (Panasonic)", S.standard), st("V-Log → Like709", S.like709)];
    case "ARRI LogC3":
      return [st("ARRI LogC3 → Rec.709 (K1S1)", { sat: 0.95, contrast: 0.95, warm: 0.01 })];
    case "S-Log3":
      return [
        st("s709 (Sony)", S.cinetone), st("LC-709 (Sony)", { sat: 0.9, contrast: 0.85 }),
        st("LC-709 Type A (Sony)", { sat: 0.95, contrast: 0.88 }), st("709 (800%) (Sony)", { sat: 1, contrast: 1.05 }),
      ];
    case "S-Log2":
      return [st("S-Log2 → 709 (Sony)", S.standard)];
    case "C-Log3":
    case "C-Log2":
      return [st("BT.709 Standard (Canon)", S.standard), st("BT.709 Wide DR (Canon)", { sat: 0.92, contrast: 0.85 })];
    case "N-Log":
      return [st("N-Log → Rec.709 (Nikon)", S.standard)];
    case "D-Log M":
      return [st("D-Log M → Rec.709 (DJI)", S.standard)];
    case "D-Log":
      return [st("D-Log → Rec.709 (DJI)", S.standard)];
    case "I-Log":
      return [st("I-Log → Rec.709 (Insta360)", S.standard)];
  }
  return [st("Log → Rec.709", S.standard)];
}
