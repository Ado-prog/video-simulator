// Sun elevation and golden / blue hour times (simplified NOAA formulas, about ±2 min).

const RAD = Math.PI / 180;

export function sunElevation(ms: number, lat: number, lon: number) {
  const n = ms / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  const h = (gmst + lon) * RAD - ra;
  return Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(h)) / RAD;
}

export type SunDay = {
  blueAm?: [number, number];
  goldenAm?: [number, number];
  sunrise?: number;
  sunset?: number;
  goldenPm?: [number, number];
  bluePm?: [number, number];
};

/** Times (ms) for the local solar day around `dateUtcMs` (midnight UTC of the chosen date). */
export function sunDay(dateUtcMs: number, lat: number, lon: number): SunDay {
  const start = dateUtcMs - (lon / 15) * 3600000; // local solar midnight
  const step = 60000;
  const el: number[] = [];
  for (let i = 0; i <= 1440; i++) el.push(sunElevation(start + i * step, lat, lon));
  const noon = el.indexOf(Math.max(...el));
  const at = (i: number) => start + i * step;
  const rise = (deg: number) => {
    for (let i = 1; i <= noon; i++) if (el[i - 1] < deg && el[i] >= deg) return at(i);
    return undefined;
  };
  const fall = (deg: number) => {
    for (let i = noon + 1; i <= 1440; i++) if (el[i - 1] > deg && el[i] <= deg) return at(i);
    return undefined;
  };
  const pair = (a?: number, b?: number): [number, number] | undefined => (a && b ? [a, b] : undefined);
  return {
    blueAm: pair(rise(-6), rise(-4)),
    goldenAm: pair(rise(-4), rise(6)),
    sunrise: rise(-0.833),
    sunset: fall(-0.833),
    goldenPm: pair(fall(6), fall(-4)),
    bluePm: pair(fall(-4), fall(-6)),
  };
}

export const PLACES: { id: string; name: string; lat: number; lon: number; tz: string }[] = [
  { id: "zrh", name: "Zürich", lat: 47.37, lon: 8.54, tz: "Europe/Zurich" },
  { id: "bsl", name: "Basel", lat: 47.56, lon: 7.59, tz: "Europe/Zurich" },
  { id: "brn", name: "Bern", lat: 46.95, lon: 7.45, tz: "Europe/Zurich" },
  { id: "lzn", name: "Luzern", lat: 47.05, lon: 8.31, tz: "Europe/Zurich" },
  { id: "gva", name: "Genève", lat: 46.2, lon: 6.14, tz: "Europe/Zurich" },
  { id: "sjj", name: "Sarajevo", lat: 43.86, lon: 18.41, tz: "Europe/Sarajevo" },
  { id: "tzl", name: "Tuzla", lat: 44.54, lon: 18.68, tz: "Europe/Sarajevo" },
  { id: "omo", name: "Mostar", lat: 43.34, lon: 17.81, tz: "Europe/Sarajevo" },
  { id: "bnx", name: "Banja Luka", lat: 44.77, lon: 17.19, tz: "Europe/Sarajevo" },
  { id: "beg", name: "Beograd", lat: 44.79, lon: 20.45, tz: "Europe/Belgrade" },
  { id: "zag", name: "Zagreb", lat: 45.81, lon: 15.98, tz: "Europe/Zagreb" },
  { id: "prn", name: "Prishtina", lat: 42.66, lon: 21.17, tz: "Europe/Belgrade" },
  { id: "skp", name: "Skopje", lat: 41.99, lon: 21.43, tz: "Europe/Skopje" },
  { id: "vie", name: "Wien", lat: 48.21, lon: 16.37, tz: "Europe/Vienna" },
  { id: "muc", name: "München", lat: 48.14, lon: 11.58, tz: "Europe/Berlin" },
  { id: "ber", name: "Berlin", lat: 52.52, lon: 13.4, tz: "Europe/Berlin" },
  { id: "ist", name: "İstanbul", lat: 41.01, lon: 28.98, tz: "Europe/Istanbul" },
];
