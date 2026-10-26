// Zebra settings the way each brand offers them, and frame-marker options.

import type { Camera } from "./gear";

export type ZebraKind = "above" | "band";
export type ZebraSlot = {
  name: "z1" | "z2"; // label key
  kind: ZebraKind;
  levels: number[]; // selectable values (percent, or 0–255 for Nikon)
  def: number;
  widths?: number[]; // ± range for band zebras (same unit as levels)
  defWidth?: number;
};
export type ZebraSpec = {
  brand: "pana" | "sony" | "canon" | "nikon" | "generic";
  scale: number; // 100 for %, 255 for Nikon's 8-bit levels
  z1: ZebraSlot;
  z2?: ZebraSlot;
  both: boolean; // both zebras can be shown at the same time
};

const steps = (from: number, to: number, step: number) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

export function zebraSpecFor(cam: Camera | undefined): ZebraSpec {
  switch (cam?.brand) {
    case "Panasonic":
      return {
        brand: "pana", scale: 100, both: true,
        z1: { name: "z1", kind: "above", levels: steps(50, 105, 5), def: 80 },
        z2: { name: "z2", kind: "above", levels: steps(50, 105, 5), def: 100 },
      };
    case "Sony":
      return {
        brand: "sony", scale: 100, both: false,
        z1: { name: "z1", kind: "above", levels: [...steps(70, 100, 5), 101], def: 95 },
        z2: { name: "z2", kind: "band", levels: steps(0, 105, 5), def: 70, widths: steps(1, 10, 1), defWidth: 5 },
      };
    case "Canon":
      return {
        brand: "canon", scale: 100, both: true,
        z1: { name: "z1", kind: "band", levels: steps(5, 95, 5), def: 70, widths: [5], defWidth: 5 },
        z2: { name: "z2", kind: "above", levels: steps(5, 100, 5), def: 100 },
      };
    case "Nikon":
      return {
        brand: "nikon", scale: 255, both: false,
        z1: { name: "z1", kind: "above", levels: steps(120, 255, 5), def: 245 },
        z2: { name: "z2", kind: "band", levels: steps(0, 255, 5), def: 180, widths: [10, 20, 30, 40, 50, 60, 70, 80], defWidth: 20 },
      };
  }
  return { brand: "generic", scale: 100, both: false, z1: { name: "z1", kind: "above", levels: steps(70, 100, 5), def: 95 } };
}

export type ZebraMode = "off" | "z1" | "z2" | "z12";

/** Zebra bands for the monitor, as 0–1 picture levels. */
export function zebraBands(spec: ZebraSpec, mode: ZebraMode, z1: number, z2: number, width: number) {
  const band = (slot: ZebraSlot, v: number, dir: 1 | -1) => {
    const lo = slot.kind === "above" ? v : v - width;
    const hi = slot.kind === "above" ? Infinity : v + width;
    // levels above 100 % (Lumix 105 %, Sony 100+) mark only the very top of the picture
    return { lo: Math.min(lo / spec.scale, 0.995), hi: hi / spec.scale, dir };
  };
  const out: { lo: number; hi: number; dir: 1 | -1 }[] = [];
  if (mode === "z1" || mode === "z12") out.push(band(spec.z1, z1, 1));
  if ((mode === "z2" || mode === "z12") && spec.z2) out.push(band(spec.z2, z2, -1));
  return out;
}

export const FRAME_RATIOS = [
  { id: "2.39", label: "2.39:1", r: 2.39 },
  { id: "2.35", label: "2.35:1", r: 2.35 },
  { id: "2.00", label: "2.00:1", r: 2 },
  { id: "1.85", label: "1.85:1", r: 1.85 },
  { id: "16:9", label: "16:9", r: 16 / 9 },
  { id: "4:3", label: "4:3", r: 4 / 3 },
  { id: "5:4", label: "5:4", r: 5 / 4 },
  { id: "1:1", label: "1:1", r: 1 },
  { id: "4:5", label: "4:5", r: 4 / 5 },
  { id: "9:16", label: "9:16", r: 9 / 16 },
] as const;
export type FrameRatioId = (typeof FRAME_RATIOS)[number]["id"];

export const FRAME_COLORS = { white: "#ffffff", yellow: "#ffd400", red: "#ff3b30", green: "#34c759", blue: "#3b8cff", black: "#000000" } as const;
export type FrameColor = keyof typeof FRAME_COLORS;
