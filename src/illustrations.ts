// Illustrated people (animated-film style, made for Mustafi Studio), cut out for the monitor.

export type Illu = { href: string; w: number; h: number };

const pic = (id: string, w: number, h: number): Illu => ({ href: `./illustration/${id}.webp`, w, h });

export const ILLU = {
  couple: pic("couple", 744, 1100),
  bride: pic("bride", 744, 1100),
  groom: pic("groom", 339, 1100),
  men: [pic("man-navy", 362, 1100), pic("man-grey", 355, 1100), pic("man-beige", 379, 1100), pic("man-tux", 341, 1100)],
  women: [pic("woman-green", 274, 1100), pic("woman-rose", 270, 1100), pic("woman-navy", 302, 1100), pic("woman-burgundy", 342, 1100)],
};
export type IlluSet = typeof ILLU;
