// Real people for the monitor: cut-out photos (Pexels / Unsplash, free licence).

import LIST from "./people.json";

export type PersonPhoto = {
  n: number; // number from the selection gallery
  kind: "couple" | "bride" | "man" | "woman";
  file: string;
  w: number;
  h: number;
  cut: boolean; // feet are outside the original photo
  src: string; // original photo page
};

export const PHOTOS = LIST as PersonPhoto[];
export const byKind = (k: PersonPhoto["kind"]) => PHOTOS.filter((p) => p.kind === k);

export const COUPLES = byKind("couple");

/** First whole-body couple. */
export const DEFAULT_COUPLE = COUPLES.find((p) => !p.cut) ?? COUPLES[0];

/** Guests for group photos: whole-body men and women. */
export const GUEST_MEN = byKind("man").filter((p) => !p.cut);
export const GUEST_WOMEN = byKind("woman").filter((p) => !p.cut);
