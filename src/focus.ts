// Focus modes (AF-S / AF-C / MF …) with each brand's own names. Approximate, for planning.

import type { Camera } from "./gear";

export type FocusKind = "s" | "c" | "a" | "f" | "dmf" | "mf";

// cameras without adjustable focus (fixed-focus action, 360° and small FPV cameras)
const FIXED = new Set([
  "dji-action5", "dji-action4", "dji-nano", "dji-osmo360", "dji-avata360", "dji-avata2", "dji-neo",
  "insta-x6", "insta-x5", "insta-x4", "insta-x3",
]);

export function fixedFocus(cam: Camera | undefined): boolean {
  return !!cam && FIXED.has(cam.id);
}

type Brand = Camera["brand"] | "generic";

const MODES: Record<Brand, { photo: FocusKind[]; video: FocusKind[] }> = {
  Panasonic: { photo: ["s", "c", "mf"], video: ["s", "c", "mf"] },
  Sony: { photo: ["s", "a", "c", "dmf", "mf"], video: ["s", "c", "mf"] },
  Canon: { photo: ["s", "c", "mf"], video: ["s", "c", "mf"] },
  Nikon: { photo: ["s", "c", "mf"], video: ["s", "c", "f", "mf"] },
  DJI: { photo: ["s", "c", "mf"], video: ["s", "c", "mf"] },
  Insta360: { photo: [], video: [] },
  generic: { photo: ["s", "c", "mf"], video: ["s", "c", "mf"] },
};

export function focusModes(cam: Camera | undefined, video: boolean): FocusKind[] {
  if (fixedFocus(cam)) return [];
  const m = MODES[cam?.brand ?? "generic"];
  return video ? m.video : m.photo;
}

// the name printed on the camera / in its menu
export function focusLabel(cam: Camera | undefined, kind: FocusKind, video: boolean): string {
  const brand = cam?.brand ?? "generic";
  if (kind === "mf") return "MF";
  if (brand === "Panasonic") return kind === "s" ? "AFS" : "AFC";
  if (brand === "Canon") return kind === "s" ? "One-Shot AF" : video ? "Movie Servo AF" : "Servo AF";
  return { s: "AF-S", c: "AF-C", a: "AF-A", f: "AF-F", dmf: "DMF" }[kind];
}

// short tag for the monitor HUD
export function focusTag(cam: Camera | undefined, kind: FocusKind, video: boolean): string {
  if (cam?.brand === "Canon" && kind !== "mf") return kind === "s" ? "ONE SHOT" : "SERVO";
  return focusLabel(cam, kind, video);
}

// keep the chosen mode if the new camera/mode has it, otherwise fall back to a sensible default
export function validFocus(kind: FocusKind, cam: Camera | undefined, video: boolean): FocusKind {
  const list = focusModes(cam, video);
  if (list.includes(kind)) return kind;
  if (kind === "a" || kind === "f") return "c";
  if (kind === "dmf") return list.includes("s") ? "s" : list[0] ?? "c";
  return list.includes(video ? "c" : "s") ? (video ? "c" : "s") : list[0] ?? "c";
}
