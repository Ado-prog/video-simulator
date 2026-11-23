// Physical switches and built-in functions of lenses and microphones.
// Values are typical figures from the makers' data sheets, rounded – treat them as approximate.

import type { Lens } from "./gear";
import type { Mic } from "./audio";

export type LensFx = {
  ois: boolean; // optical stabiliser with its own switch
  afmf: boolean; // AF/MF switch on the barrel
  limiter: number | null; // focus limiter: near limit in metres when switched on
  apRing: boolean; // aperture ring
  declick: boolean; // aperture ring can be de-clicked
  clutch: boolean; // pull-back focus ring (focus clutch) with distance scale
  fn: boolean; // focus-hold / Fn button
  ctrlRing: boolean; // freely assignable control ring
  zoomLock: boolean;
  pz: boolean; // power zoom
  sealed: boolean; // dust and splash protection
  mfd: number; // closest focus distance in metres
  weight: number | null; // grams
};

const has = (s: string, ...parts: string[]) => parts.some((p) => s.includes(p));

// [closest focus m, weight g] where the figure is well known
const KNOWN: Record<string, [number, number]> = {
  "Lumix S PRO 24-70mm F2.8": [0.37, 935], "Lumix S PRO 70-200mm F2.8 O.I.S.": [0.95, 1570], "Lumix S PRO 16-35mm F4": [0.25, 500],
  "Lumix S 24-105mm F4 Macro O.I.S.": [0.3, 680], "Lumix S 20-60mm F3.5-5.6": [0.15, 350], "Lumix S 14-28mm F4-5.6 Macro": [0.15, 345],
  "Lumix S 18-40mm F4.5-6.3": [0.15, 155], "Lumix S 28-200mm F4-7.1 Macro O.I.S.": [0.14, 413], "Lumix S 70-300mm F4.5-5.6 Macro O.I.S.": [0.54, 790],
  "Lumix S PRO 50mm F1.4": [0.44, 955], "Lumix S 18mm F1.8": [0.18, 340], "Lumix S 24mm F1.8": [0.24, 310], "Lumix S 35mm F1.8": [0.24, 295],
  "Lumix S 50mm F1.8": [0.45, 300], "Lumix S 85mm F1.8": [0.8, 355], "Lumix S 100mm F2.8 Macro": [0.2, 298],
  "FE 24-70mm F2.8 GM II": [0.21, 695], "FE 16-35mm F2.8 GM II": [0.22, 547], "FE 70-200mm F2.8 GM OSS II": [0.4, 1045],
  "FE 24-105mm F4 G OSS": [0.38, 663], "FE 50mm F1.2 GM": [0.4, 778], "FE 85mm F1.4 GM II": [0.85, 642], "FE 135mm F1.8 GM": [0.7, 950],
  "FE 90mm F2.8 Macro G OSS": [0.28, 602], "FE 50mm F1.8": [0.45, 186], "FE 100-400mm F4.5-5.6 GM OSS": [0.98, 1395],
  "RF 24-70mm F2.8 L IS USM": [0.21, 900], "RF 28-70mm F2 L USM": [0.39, 1430], "RF 70-200mm F2.8 L IS USM Z": [0.49, 1110],
  "RF 15-35mm F2.8 L IS USM": [0.28, 840], "RF 24-105mm F4 L IS USM": [0.45, 700], "RF 50mm F1.2 L USM": [0.4, 950],
  "RF 85mm F1.2 L USM": [0.85, 1195], "RF 50mm F1.8 STM": [0.3, 160], "RF 100-500mm F4.5-7.1 L IS USM": [0.9, 1370],
  "RF 100mm F2.8 L Macro IS USM": [0.26, 730], "RF 35mm F1.8 Macro IS STM": [0.17, 305], "RF 85mm F2 Macro IS STM": [0.35, 500],
  "Nikkor Z 24-70mm f/2.8 S": [0.38, 805], "Nikkor Z 70-200mm f/2.8 VR S": [0.5, 1360], "Nikkor Z 14-24mm f/2.8 S": [0.28, 650],
  "Nikkor Z 24-120mm f/4 S": [0.35, 630], "Nikkor Z 50mm f/1.8 S": [0.4, 415], "Nikkor Z 85mm f/1.8 S": [0.8, 470],
  "Nikkor Z 50mm f/1.2 S": [0.45, 1090], "Nikkor Z 135mm f/1.8 S Plena": [0.82, 995], "Nikkor Z MC 105mm f/2.8 VR S": [0.29, 630],
  "24-70mm F2.8 DG DN II Art": [0.17, 745], "70-200mm F2.8 DG DN OS Sports": [0.65, 1345], "35mm F1.4 DG DN Art": [0.3, 645],
  "50mm F1.2 DG DN Art": [0.4, 745], "85mm F1.4 DG DN Art": [0.85, 630], "28-75mm F/2.8 Di III VXD G2": [0.18, 540],
  "35-150mm F/2-2.8 Di III VXD": [0.33, 1165], "70-180mm F/2.8 Di III VXD G2": [0.3, 855],
};

// no AF/MF switch on the barrel (focus mode is set in the camera menu)
const NO_AFMF = [
  "Lumix S 18-40mm", "FE 50mm F1.8", "FE 28-70mm", "E PZ 16-50mm", "E 18-135mm", "DC DN Contemporary", "17-28mm F/2.8", "28-200mm F/2.8-5.6",
  "17-70mm F/2.8", "RF-S ", "RF 50mm F1.8", "Nikkor Z DX", "Nikkor Z 40mm", "Nikkor Z 28-75mm", "Nikkor Z 24-200mm", "Nikkor Z 28-400mm",
  "Nikkor Z 35mm f/1.4", "Lumix G 42.5mm", "Lumix G Vario 12-60mm",
];
const AP_RING = [
  " GM", "FE 24-50mm F2.8 G", "FE 16-25mm F2.8 G", "FE 20-70mm F4 G", "DG DN Art", "DG DN II Art", "DG DN OS Sports", " VCM", "USM Z",
  "Vario-Summilux 10-25mm",
];
const NO_AP_RING = ["FE 100-400mm"]; // GM, but no aperture ring
const ZOOM_LOCK = ["28-200mm", "24-240mm", "24-200mm", "28-400mm", "100-400mm", "100-500mm", "50-400mm", "70-300mm", "18-150mm", "18-140mm", "50-250mm", "RF 24-105mm F4 L", "DG DN II Art", "70-350mm"];
const LIMITER_AT: [string, number][] = [
  ["70-200mm F2.8 GM", 3], ["70-200mm F4 Macro", 3], ["100-400mm F4.5-5.6 GM", 3], ["90mm F2.8 Macro", 0.5], ["135mm F1.8 GM", 1.5],
  ["Lumix S PRO 70-200mm", 5], ["Lumix S 70-300mm", 3], ["Lumix S 100mm F2.8 Macro", 0.5], ["Vario-Elmar 100-400mm", 5],
  ["DG DN OS Sports", 3], ["100-400mm F5-6.3", 3], ["RF 70-200mm F2.8", 2.5], ["RF 100-500mm", 3], ["RF 100mm F2.8 L Macro", 0.5],
  ["RF 85mm F2 Macro", 0.5], ["RF 35mm F1.8 Macro", 0], ["Z 70-200mm", 5], ["Z 100-400mm", 3], ["MC 105mm", 0.5], ["Plena", 0],
  ["70-180mm", 0], ["50-400mm", 0], ["35-150mm", 0],
];

export function lensFx(lens: Lens): LensFx {
  const n = lens.name;
  const m = lens.maker;
  const zoom = lens.minFocal !== lens.maxFocal;
  const pro =
    has(n, " L ", " GM", "S PRO", "Art", "Sports", "Leica", "Plena") || n.endsWith(" S") || has(n, " S ") && m === "Nikon" || (m === "Sony" && (n.endsWith(" G") || has(n, " G ")));
  const ois = has(n, "O.I.S.", "OSS", " IS ", " VR", " VC", " OS ", "Vario-Elmar", "Vario-Elmarit", "X Vario", "G Vario", "42.5mm");
  const lim = LIMITER_AT.find(([k]) => n.includes(k));
  const apRing = AP_RING.some((k) => n.includes(k)) && !NO_AP_RING.some((k) => n.includes(k));
  const known = KNOWN[n];
  const macro = has(n, "Macro", " MC ");
  const mfd = known
    ? known[0]
    : macro
      ? 0.25
      : zoom
        ? Math.round((0.22 + lens.maxFocal / 420) * 100) / 100
        : Math.round((lens.maxFocal * 0.0075 + 0.07) * 100) / 100;
  return {
    ois,
    afmf: !NO_AFMF.some((k) => n.includes(k)),
    limiter: lim && lim[1] > 0 ? lim[1] : null,
    apRing,
    declick: apRing && !has(n, "Vario-Summilux"),
    clutch: has(n, "S PRO", "Vario-Summilux 10-25mm"),
    fn: (m === "Sony" && pro) || (m === "Sigma" && has(n, "Art", "Sports")) || (m === "Nikon" && has(n, "f/2.8 S", "f/1.2 S", "Plena", "VR S")) || has(n, "S PRO 70-200mm", "G2", "35-150mm", "50-400mm"),
    ctrlRing: m === "Canon" || m === "Nikon",
    zoomLock: zoom && ZOOM_LOCK.some((k) => n.includes(k)),
    pz: has(n, " PZ"),
    sealed: pro || m === "Tamron" || (m === "Panasonic" && has(n, "Lumix S ", "X Vario")),
    mfd,
    weight: known ? known[1] : null,
  };
}

export type MicFx = {
  conn: string; // output connector
  power: "plugin" | "battery" | "phantom" | "shoe" | "aa";
  hours?: number; // battery life
  range?: number; // wireless range in metres, line of sight
  lowCut?: number[]; // switchable high-pass filters in Hz
  lcNames?: string[]; // names printed on the switch instead of Hz
  pad?: number[]; // attenuator steps in dB
  steps?: number[]; // stepped output level in dB
  boost?: boolean; // high-frequency boost
  gainAssist?: boolean; // automatic level in the transmitter
  monitor?: boolean; // headphone output
  usb?: boolean; // works as a USB microphone
  autoPower?: boolean; // switches on with the camera
  timecode?: boolean;
  mute?: boolean;
  phone?: boolean; // made for phones (no camera receiver in the box)
  lcWind?: boolean; // the low-cut switch is labelled WIND CUT on the mic
  noiseCut?: { names: string[]; db: number[] }; // NOISE CUT switch: less steady room noise
  micLim?: string[]; // limiter switch on the mic, e.g. OFF / ON / AUTO
  dial?: [number, number]; // continuous level dial in dB (min, max)
  safetyCh?: number; // dB of the mic's own safety channel (second channel)
  cam?: CamKey[]; // settings in the camera menu when the mic sits on the digital shoe
  app?: AppKey[]; // settings in the receiver menu or the maker's app
};

export type CamKey = "pattern" | "f32" | "ch4" | "level" | "wind" | "rate" | "hp" | "power";
export type AppKey = "gain" | "hpf" | "f32" | "tc" | "safety" | "stereo" | "led" | "nc" | "rec" | "fw";

const TRS = "3,5 mm TRS";
const XLR = "XLR";

const MIC_FX: Record<string, MicFx> = {
  "rode-wpro": { conn: `${TRS} / USB-C`, power: "battery", hours: 7, range: 260, gainAssist: true, monitor: true, usb: true, timecode: true, mute: true, lowCut: [75, 150], app: ["gain", "hpf", "f32", "tc", "safety", "stereo", "led", "rec", "fw"] },
  "pana-dms1": {
    conn: "Multi-Interface (digital)", power: "shoe", lowCut: [100, 200], lcNames: ["STD", "HI"], lcWind: true,
    noiseCut: { names: ["STD", "HI"], db: [4, 8] }, steps: [-20, 0, 20], dial: [-12, 12], micLim: ["OFF", "ON", "AUTO"],
    cam: ["pattern", "f32", "ch4", "level", "wind", "rate", "hp", "power"],
  },
  "pana-ms2": { conn: TRS, power: "plugin" },
  "rode-wgo3": { conn: `${TRS} / USB-C`, power: "battery", hours: 7, range: 260, gainAssist: true, monitor: true, usb: true, mute: true, lowCut: [75, 150], app: ["gain", "hpf", "f32", "safety", "stereo", "led", "rec", "fw"] },
  "rode-wme": { conn: `${TRS} / USB-C`, power: "battery", hours: 7, range: 100, gainAssist: true, usb: true },
  "rode-vmntg": { conn: `${TRS} / USB-C`, power: "battery", hours: 30, lowCut: [75, 150], pad: [-20], boost: true, monitor: true, usb: true, autoPower: true, dial: [-20, 20], safetyCh: -20 },
  "rode-vmgo2": { conn: `${TRS} / USB-C`, power: "plugin", monitor: true, usb: true },
  "rode-vmicro2": { conn: TRS, power: "plugin" },
  "rode-ntg4p": { conn: XLR, power: "phantom", hours: 150, lowCut: [75], pad: [-10], boost: true },
  "rode-ntg5": { conn: XLR, power: "phantom" },
  "dji-mic2": { conn: `${TRS} / USB-C`, power: "battery", hours: 6, range: 250, lowCut: [150], steps: [-12, -6, 0, 6, 12], monitor: true, usb: true, mute: true, app: ["gain", "nc", "f32", "safety", "stereo", "rec", "fw"] },
  "dji-micmini": { conn: `${TRS} / USB-C`, power: "battery", hours: 11, range: 400, steps: [-12, -6, 0, 6, 12], mute: true },
  "senn-mke600": { conn: XLR, power: "aa", hours: 150, lowCut: [100] },
  "senn-mke400": { conn: "3,5 mm TRS/TRRS", power: "battery", hours: 100, lowCut: [200], steps: [-20, 0, 20], monitor: true, autoPower: true },
  "senn-profile": { conn: `${TRS} / USB-C`, power: "battery", hours: 7, range: 245, monitor: true, usb: true, mute: true },
  "senn-ewdp": { conn: `${TRS} / XLR`, power: "aa", hours: 12, range: 100, mute: true },
  "deity-d3pro": { conn: "3,5 mm TRRS (Smart)", power: "battery", hours: 51, lowCut: [75, 150], autoPower: true, dial: [-20, 20] },
  "holly-m2": { conn: `${TRS} / USB-C`, power: "battery", hours: 10, range: 300 },
  "holly-max": { conn: `${TRS} / USB-C`, power: "battery", hours: 7.5, range: 250, monitor: true, mute: true },
  "sony-ecmb10": { conn: "MI-Schuh (digital)", power: "shoe", noiseCut: { names: ["ON"], db: [6] }, cam: ["level", "wind", "f32", "rate", "hp", "power"] },
  "sony-ecmb1m": { conn: "MI-Schuh (digital)", power: "shoe", lowCut: [100], lcNames: ["LC"], pad: [-10, -20], noiseCut: { names: ["ON"], db: [6] }, cam: ["level", "wind", "f32", "ch4", "rate", "hp", "power"] },
  "canon-dme1d": { conn: "Multi-Funktions-Schuh (digital)", power: "shoe", lowCut: [100], lcWind: true, cam: ["level", "wind", "ch4", "rate", "hp", "power"] },
  "nikon-me1": { conn: TRS, power: "plugin", lowCut: [100] },
  "dji-mic3": { conn: `${TRS} / USB-C`, power: "battery", hours: 8, range: 400, lowCut: [150], steps: [-12, -6, 0, 6, 12], monitor: true, usb: true, timecode: true, mute: true, app: ["gain", "nc", "f32", "tc", "safety", "stereo", "rec", "fw"] },
  "dji-mic1": { conn: `${TRS} / USB-C`, power: "battery", hours: 5.5, range: 250, lowCut: [150], monitor: true, mute: true },
  "rode-wgo2": { conn: `${TRS} / USB-C`, power: "battery", hours: 7, range: 200, pad: [-10, -20], usb: true, mute: true },
  "rode-wmicro": { conn: "USB-C / Lightning", power: "battery", hours: 7, range: 100, gainAssist: true, phone: true },
  "rode-vmproplus": { conn: TRS, power: "battery", hours: 100, lowCut: [75, 150], steps: [-10, 0, 20], boost: true, autoPower: true, safetyCh: -10 },
  "senn-mke200": { conn: "3,5 mm TRS/TRRS", power: "plugin" },
  "holly-m1": { conn: TRS, power: "battery", hours: 8, range: 200 },
  "holly-m2s": { conn: `${TRS} / USB-C`, power: "battery", hours: 9, range: 300 },
  "holly-c1": { conn: "USB-C / Lightning", power: "battery", hours: 8, range: 200, phone: true },
  "sara-ultra": { conn: `${TRS} / USB-C`, power: "battery", hours: 6, range: 300, monitor: true, usb: true, timecode: true, mute: true },
  "sara-blink500": { conn: TRS, power: "battery", hours: 20, range: 100, monitor: true },
  "deity-theos": { conn: "3,5 mm / TA3", power: "aa", hours: 10, range: 150, lowCut: [80], timecode: true, mute: true },
  "zoom-f2": { conn: "microSD", power: "aa", hours: 15, lowCut: [80, 160] },
  "tascam-dr10l": { conn: "microSD", power: "aa", hours: 24, lowCut: [80, 120], timecode: true },
  "shure-movemic": { conn: "Bluetooth / USB-C", power: "battery", hours: 8, range: 30, phone: true },
  "sony-ecmw3": { conn: "MI-Schuh (digital) / 3,5 mm", power: "battery", hours: 6, range: 150, lowCut: [100], lcNames: ["LC"], pad: [-10, -20], mute: true },
  "comica-vimo": { conn: `${TRS} / USB-C`, power: "battery", hours: 7, range: 200, mute: true },
};

export const micFx = (mic: Mic): MicFx | null => MIC_FX[mic.id] ?? null;

/** How many dB of wind and rumble a high-pass filter at this frequency removes. */
export const lowCutDb = (hz: number) => (hz <= 0 ? 0 : hz < 90 ? 8 : hz < 130 ? 11 : hz < 180 ? 14 : 16);

const de = {
  nzBtn: "Rauschen minimieren",
  nzmHead: "Weniger Rauschen – das wurde gemacht / das machst du an der Kamera:",
  nzmBase: "ISO auf den Basis-ISO {x} – dort rauscht die Kamera am wenigsten.",
  nzmRaise: "Wenig Licht: ISO auf {x} – so niedrig wie möglich, aber hell genug.",
  nzmSecond: "Wenig Licht: ISO auf den zweiten Basis-ISO {x} (Dual Native) – sauberer als ein ISO knapp darunter.",
  nzmNd: "ND-Filter {x}, damit Basis-ISO, Blende und Verschluss bleiben können.",
  nzmOpen: "Blende auf {x} geöffnet – mehr Licht auf den Sensor (dafür weniger Schärfentiefe).",
  nzmLight: "⚠ Es fehlen noch ca. {x} Blenden Licht: LED/Fenster dazu oder ein lichtstärkeres Objektiv – sonst bleibt Rauschen.",
  nzmEttr: "Log: ca. +1,3 Blenden heller belichtet (ETTR) – in der Post runterziehen, die ETTR-Vorschau ist eingeschaltet.",
  nzmShutterP: "Verschlusszeit {x} (Grenze aus der Hand ca. {y}).",
  nzmTripod: "⚠ Noch zu dunkel für aus der Hand: Stativ, Blitz oder mehr Licht.",
  nzmCheck: "Ergebnis: siehe Rauschen- und Belichtungsanzeige in der Statusleiste.",
  isoExtShort: "erweitert",
  isoExtInfo: "Erweitert nach unten: L {x} – nur im Standardprofil, nicht in Log.",
  isoExt: "Erweiterter ISO L {x}: unter dem Basis-ISO {y} – ca. 1 Blende weniger Dynamik in den Lichtern. Gut für Sonne ohne ND, sonst lieber ND-Filter.",
  isoRange: "{x}: ISO {y} – das Minimum ist der Basis-ISO im Standardprofil (z. B. bei Sonne).",
  isoLog: "Log-Basis-ISO: {x} – darunter weniger Dynamikumfang.",
  dmAuto: "AUTO: Die Kamera schaltet selbst – unter ISO {y} der niedrige Kreis (Basis {x}), ab da der hohe. Für die meisten Aufnahmen richtig.",
  dmLow: "LOW: Immer der niedrige Kreis (Basis {x}) – maximale Dynamik bei Tageslicht. Über ca. {y} rauscht es deutlich mehr.",
  dmHigh: "HIGH: Immer der hohe Kreis – kleinster ISO ist {y}. Für Nacht, Innenräume und wenig Licht: sauberes Bild bei hohem ISO.",
  dmLowWarn: "ISO {x} im LOW-Kreis: mehr Rauschen als nötig – auf AUTO oder HIGH stellen (Basis {y}).",
  isoDual: "Dual Native ISO: {x} – auf dem zweiten Basiswert wieder sauber (wenig Rauschen).",
  exHead: "Richtig belichtet – das wurde gemacht / das machst du an der Kamera:",
  exAperture: "Blende bleibt {x} (bestimmt Schärfentiefe und Look).",
  exShutterV: "Verschlusszeit bleibt {x} (180°-Regel: doppelte Bildrate).",
  exShutterP: "Verschlusszeit auf {x} gestellt.",
  exIsoP: "ISO {x}.",
  exIsoV: "ISO auf {x} gestellt (so niedrig wie möglich = wenig Rauschen).",
  exIsoAuto: "ISO steht auf Auto – die Kamera regelt selbst.",
  exNd: "ND-Filter {x} vors Objektiv – nimmt Licht weg, ohne Blende oder Verschluss zu ändern.",
  exNoNd: "Kein ND-Filter nötig.",
  exDark: "⚠ Es fehlen {x} Blenden Licht: Blende öffnen, ISO erhöhen oder mehr Licht (LED, Fenster) – sonst rauscht es.",
  exLog: "{x}: ab Basis-ISO {y}. Für saubere Schatten +1 bis +2 Blenden heller belichten (ETTR) und in der Post runterziehen.",
  exShake: "⚠ Verschlusszeit länger als 1/Brennweite – Stabilisator einschalten oder Stativ.",
  exCheckV: "Kontrolle: Zebra/Histogramm – Gesicht ca. 70 % (Rec.709) bzw. Hauttöne in Log nach Herstellerwert.",
  exCheckP: "Kontrolle: Histogramm ansehen, Lichter dürfen nicht anstoßen.",
  expOk: "Belichtung OK", expOver: "Überbelichtet", expUnder: "Unterbelichtet", expClip: "Clipping",
  nzHead: "Bildrauschen & ETTR", nzOn: "Rauschen simulieren", nzEttr: "ETTR-Vorschau: in der Post runterziehen",
  nzChip: { low: "Rauschen gering", mid: "Rauschen mittel", high: "Rauschen stark" }, nzOffChip: "Rauschen aus",
  nzStateOn: "Rauschen-Simulation an: Rauschen steigt mit ISO, wenig Licht und Unterbelichtung – in Log sieht man es in den Schatten besonders.",
  nzStateOff: "Rauschen-Simulation aus: das Bild ist sauberer als in Wirklichkeit.",
  nzUnder: "⚠ {x} Blenden unterbelichtet: beim Aufhellen in der Post kommt das Rauschen mit hoch (wie leise Aufnahme laut drehen).",
  nzEttrTip: "ETTR (Expose To The Right): in Log +1 bis +2 Blenden heller belichten, Lichter nicht clippen, in der Post runterziehen – das Rauschen geht mit runter.",
  nzEttrGood: "✓ +{x} Blenden belichtet und in der Post runtergezogen: saubere Schatten, satte Farben.",
  nzClip: "⚠ Lichter clippen (über +{x} Blenden) – Zebra auf Clip-Level stellen und abblenden, bis die Streifen verschwinden.",
  nzLog: "Faustregel Log: Belichte fürs Rauschen, grade für den Look.",
  windSw: "WIND CUT am Mikrofon", noiseSw: "NOISE CUT am Mikrofon", limSwMic: "Limiter am Mikrofon (LMT)", dialSw: "Pegelregler am Mikrofon (Drehrad)",
  safetyChip: "Sicherheitskanal {x} dB", camHead: "Einstellungen im Kameramenü", appHead: "Einstellungen im Empfänger / in der App",
  camKeys: { pattern: "Richtcharakteristik", f32: "32-Bit-Float-Aufnahme", ch4: "4-Kanal-Aufnahme (Backup)", level: "Tonpegel", wind: "Windgeräuschreduzierung", rate: "Abtastrate 48 / 96 kHz", hp: "Kopfhörer-Lautstärke", power: "Strom über den Kameraschuh" },
  appKeys: { gain: "Verstärkung", hpf: "Hochpassfilter", f32: "32-Bit-Float intern", tc: "Timecode", safety: "Sicherheitsspur", stereo: "Mono / Stereo / Merged", led: "LED-Helligkeit", nc: "Rauschunterdrückung", rec: "Interne Aufnahme", fw: "Firmware-Update" },
  noiseTip: "NOISE CUT nimmt gleichmäßiges Rauschen (Klimaanlage, Lüfter) weg – auf HI können Stimmen etwas künstlich klingen.",
  windTip: "WIND CUT auf HI schneidet tiefe Frequenzen stärker – gut draußen bei Wind, drinnen klingen Stimmen dünner.",
  micLimTip: "Der Limiter im Mikrofon fängt laute Spitzen ab, bevor sie zur Kamera gehen (AUTO: nur wenn nötig).",
  dialTip: "Mit dem Drehrad stellst du den Pegel fein ein, zusätzlich zum GAIN-Schalter.",
  lensFx: "Schalter & Funktionen am Objektiv",
  micFx: "Schalter & Funktionen am Mikrofon",
  ois: "Bildstabilisator im Objektiv", afmf: "AF/MF-Schalter", limiter: "Fokusbegrenzer", apRing: "Blendenring", declick: "Blendenring entklickbar",
  clutch: "Fokusring zum Zurückziehen (MF-Kupplung)", fn: "Fokushalte-/Fn-Taste", ctrlRing: "Steuerring (frei belegbar)", zoomLock: "Zoom-Sperre",
  pz: "Motorzoom (Power Zoom)", sealed: "Staub- und Spritzwasserschutz", mfd: "Naheinstellgrenze {x}", weight: "{x} g",
  oisSw: "Stabilisator am Objektiv ein", mfSw: "AF/MF-Schalter auf MF", limSw: "Fokusbereich", limFull: "FULL – ganzer Bereich", limFar: "{x} – ∞ (schnellerer AF)",
  oisOn: "✓ Objektiv- und Sensor-Stabilisator arbeiten zusammen.", oisOff: "Stabilisator am Objektiv aus – richtig auf dem Stativ, aus der Hand wackelt es bei langer Brennweite mehr.",
  tooClose: "⚠ Motiv bei {x} – dieses Objektiv stellt erst ab {y} scharf. Geh zurück oder nimm ein Makro-Objektiv.",
  limBlock: "⚠ Fokusbegrenzer auf {x} – ∞: das Motiv bei {y} ist zu nah, der Autofokus findet es nicht. Auf FULL stellen.",
  limOk: "✓ Der Autofokus sucht nur ab {x} – schneller und ohne Pumpen bei entfernten Motiven.",
  declickTip: "Für Video den Blendenring entklicken: die Blende läuft stufenlos und lautlos.",
  conn: "Anschluss: {x}", pwPlugin: "Strom von der Kamera (Plug-in-Power)", pwBattery: "Eingebauter Akku", pwPhantom: "48 V Phantomspeisung", pwShoe: "Strom über den Kameraschuh", pwAa: "Batterien (AA/AAA)",
  hours: "ca. {x} h", range: "Reichweite ca. {x} m", monitor: "Kopfhörerausgang", usb: "USB-Mikrofon", autoPower: "schaltet mit der Kamera ein", timecode: "Timecode",
  gainAssist: "GainAssist (automatischer Pegel)", mute: "Stummtaste", phone: "fürs Smartphone",
  lowCutSw: "Low-Cut am Mikrofon", off: "Aus", padSw: "Dämpfung (PAD)", stepSw: "Pegelschalter", boostSw: "Höhenanhebung (High Boost)",
  boostTip: "Gleicht die Höhen aus, die Fell-Windschutz und Abstand schlucken.",
  lc150: "Ein hoher Low-Cut nimmt Wind und Trittschall weg, macht Stimmen aber etwas dünner.",
  padTip: "⚠ Sehr laute Quelle: PAD einschalten, sonst verzerrt schon das Mikrofon – das rettet auch kein Pegelregler.",
  phantomTip: "Braucht 48 V Phantomspeisung: an der Kamera nur mit XLR-Adapter (z. B. DMW-XLR2, XLR-K3M) oder Recorder.",
  phoneTip: "Dieses System ist fürs Smartphone gebaut – an der Kamera nur mit zusätzlichem Empfänger/Adapter.",
  rangeTip: "⚠ {x} Abstand: nahe an der Reichweitengrenze (Körper und Wände schlucken Funk) – interne Aufnahme im Sender als Sicherung einschalten.",
  approx: "Angaben ca., laut Herstellerdaten.",
};
type Txt = typeof de;

const bs: Txt = {
  nzBtn: "Smanji šum",
  nzmHead: "Manje šuma – ovo je urađeno / ovo radiš na kameri:",
  nzmBase: "ISO na bazni ISO {x} – tu kamera ima najmanje šuma.",
  nzmRaise: "Malo svjetla: ISO na {x} – što niže, ali dovoljno svijetlo.",
  nzmSecond: "Malo svjetla: ISO na drugi bazni ISO {x} (Dual Native) – čistije nego ISO malo ispod toga.",
  nzmNd: "ND filter {x}, da bazni ISO, blenda i zatvarač mogu ostati.",
  nzmOpen: "Blenda otvorena na {x} – više svjetla na senzor (ali manja dubinska oštrina).",
  nzmLight: "⚠ Fali još oko {x} blende svjetla: dodaj LED/prozor ili svjetliji objektiv – inače ostaje šum.",
  nzmEttr: "Log: eksponirano oko +1,3 blende svjetlije (ETTR) – u postu povuci dolje, ETTR pregled je uključen.",
  nzmShutterP: "Zatvarač {x} (granica iz ruke oko {y}).",
  nzmTripod: "⚠ Još pretamno za iz ruke: stativ, blic ili više svjetla.",
  nzmCheck: "Rezultat: pogledaj prikaz šuma i ekspozicije u statusnoj traci.",
  isoExtShort: "prošireno",
  isoExtInfo: "Prošireno nadolje: L {x} – samo u standardnom profilu, ne u Logu.",
  isoExt: "Prošireni ISO L {x}: ispod baznog ISO {y} – oko 1 blenda manje dinamike u svjetlima. Dobro za sunce bez ND-a, inače radije ND filter.",
  isoRange: "{x}: ISO {y} – minimum je bazni ISO u standardnom profilu (npr. na suncu).",
  isoLog: "Bazni ISO za Log: {x} – ispod toga manji dinamički raspon.",
  dmAuto: "AUTO: kamera sama prebacuje – ispod ISO {y} niski krug (baza {x}), od te vrijednosti visoki. Ispravno za većinu snimanja.",
  dmLow: "LOW: uvijek niski krug (baza {x}) – najveća dinamika na dnevnom svjetlu. Iznad oko {y} ima znatno više šuma.",
  dmHigh: "HIGH: uvijek visoki krug – najmanji ISO je {y}. Za noć, enterijer i malo svjetla: čista slika na visokom ISO.",
  dmLowWarn: "ISO {x} u LOW krugu: više šuma nego što treba – prebaci na AUTO ili HIGH (baza {y}).",
  isoDual: "Dual Native ISO: {x} – na drugoj baznoj vrijednosti opet čisto (malo šuma).",
  exHead: "Pravilno eksponirano – ovo je urađeno / ovo radiš na kameri:",
  exAperture: "Blenda ostaje {x} (određuje dubinsku oštrinu i izgled).",
  exShutterV: "Brzina zatvarača ostaje {x} (pravilo 180°: duplo od broja sličica).",
  exShutterP: "Brzina zatvarača postavljena na {x}.",
  exIsoP: "ISO {x}.",
  exIsoV: "ISO postavljen na {x} (što niže = manje šuma).",
  exIsoAuto: "ISO je na Auto – kamera sama podešava.",
  exNd: "ND filter {x} ispred objektiva – smanjuje svjetlo bez mijenjanja blende i zatvarača.",
  exNoNd: "ND filter nije potreban.",
  exDark: "⚠ Fali {x} blende svjetla: otvori blendu, podigni ISO ili dodaj svjetlo (LED, prozor) – inače će biti šuma.",
  exLog: "{x}: od baznog ISO {y}. Za čiste sjene eksponiraj +1 do +2 blende svjetlije (ETTR) i u postu povuci dolje.",
  exShake: "⚠ Zatvarač duži od 1/žižna daljina – uključi stabilizator ili stativ.",
  exCheckV: "Provjera: zebra/histogram – lice oko 70 % (Rec.709), u Logu ten po vrijednosti proizvođača.",
  exCheckP: "Provjera: pogledaj histogram, svjetla ne smiju udariti u desni rub.",
  expOk: "Ekspozicija OK", expOver: "Preeksponirano", expUnder: "Podeksponirano", expClip: "Clipping",
  nzHead: "Šum slike i ETTR", nzOn: "Simuliraj šum", nzEttr: "ETTR pregled: povuci dolje u postu",
  nzChip: { low: "Šum mali", mid: "Šum srednji", high: "Šum jak" }, nzOffChip: "Šum isključen",
  nzStateOn: "Simulacija šuma uključena: šum raste s ISO-om, slabim svjetlom i podeksponiranjem – u Logu se naročito vidi u sjenama.",
  nzStateOff: "Simulacija šuma isključena: slika je čistija nego u stvarnosti.",
  nzUnder: "⚠ {x} blende podeksponirano: kad u postu posvijetliš, šum dođe s tim (kao kad tihi snimak pojačaš).",
  nzEttrTip: "ETTR (Expose To The Right): u Logu eksponiraj +1 do +2 blende svjetlije, ne pali svjetla (clipping), u postu povuci dolje – šum ide dolje s tim.",
  nzEttrGood: "✓ Eksponirano +{x} blende i povučeno dolje u postu: čiste sjene, bogate boje.",
  nzClip: "⚠ Svjetla se pale (clipping, preko +{x} blende) – zebru stavi na clip-nivo i zatvaraj blendu dok pruge ne nestanu.",
  nzLog: "Pravilo za Log: eksponiraj za šum, gradiraj za izgled.",
  windSw: "WIND CUT na mikrofonu", noiseSw: "NOISE CUT na mikrofonu", limSwMic: "Limiter na mikrofonu (LMT)", dialSw: "Regulator nivoa na mikrofonu (točkić)",
  safetyChip: "Sigurnosni kanal {x} dB", camHead: "Podešavanja u meniju kamere", appHead: "Podešavanja u prijemniku / aplikaciji",
  camKeys: { pattern: "Karakteristika usmjerenosti", f32: "32-bit float snimanje", ch4: "4-kanalno snimanje (rezerva)", level: "Nivo zvuka", wind: "Smanjenje šuma vjetra", rate: "Frekvencija uzorkovanja 48 / 96 kHz", hp: "Jačina slušalica", power: "Struja preko stopice kamere" },
  appKeys: { gain: "Pojačanje", hpf: "Visokopropusni filter", f32: "32-bit float interno", tc: "Timecode", safety: "Sigurnosna traka", stereo: "Mono / Stereo / Spojeno", led: "Jačina LED-a", nc: "Uklanjanje šuma", rec: "Interno snimanje", fw: "Ažuriranje firmvera" },
  noiseTip: "NOISE CUT skida ravnomjeran šum (klima, ventilator) – na HI glas može zvučati malo vještački.",
  windTip: "WIND CUT na HI jače reže niske frekvencije – dobro napolju na vjetru, unutra glas zvuči tanje.",
  micLimTip: "Limiter u mikrofonu hvata glasne vrhove prije nego odu u kameru (AUTO: samo kad treba).",
  dialTip: "Točkićem fino podešavaš nivo, uz GAIN prekidač.",
  lensFx: "Prekidači i funkcije na objektivu",
  micFx: "Prekidači i funkcije na mikrofonu",
  ois: "Stabilizator u objektivu", afmf: "AF/MF prekidač", limiter: "Limiter fokusa", apRing: "Prsten blende", declick: "Prsten blende bez klika",
  clutch: "Fokus prsten na povlačenje (MF kvačilo)", fn: "Tipka za držanje fokusa / Fn", ctrlRing: "Kontrolni prsten (slobodno podesiv)", zoomLock: "Blokada zuma",
  pz: "Motorni zum (Power Zoom)", sealed: "Zaštita od prašine i prskanja", mfd: "Najbliži fokus {x}", weight: "{x} g",
  oisSw: "Stabilizator na objektivu uključen", mfSw: "AF/MF prekidač na MF", limSw: "Opseg fokusa", limFull: "FULL – cijeli opseg", limFar: "{x} – ∞ (brži AF)",
  oisOn: "✓ Stabilizator objektiva i senzora rade zajedno.", oisOff: "Stabilizator na objektivu isključen – ispravno na stativu, iz ruke se na dugoj žižnoj daljini više trese.",
  tooClose: "⚠ Motiv na {x} – ovaj objektiv oštri tek od {y}. Odmakni se ili uzmi makro objektiv.",
  limBlock: "⚠ Limiter fokusa na {x} – ∞: motiv na {y} je preblizu, autofokus ga ne nalazi. Prebaci na FULL.",
  limOk: "✓ Autofokus traži samo od {x} – brže i bez pumpanja kod udaljenih motiva.",
  declickTip: "Za video isključi klik na prstenu blende: blenda ide glatko i nečujno.",
  conn: "Priključak: {x}", pwPlugin: "Struja iz kamere (plug-in power)", pwBattery: "Ugrađena baterija", pwPhantom: "48 V fantomsko napajanje", pwShoe: "Struja preko stopice kamere", pwAa: "Baterije (AA/AAA)",
  hours: "oko {x} h", range: "Domet oko {x} m", monitor: "Izlaz za slušalice", usb: "USB mikrofon", autoPower: "pali se s kamerom", timecode: "Timecode",
  gainAssist: "GainAssist (automatski nivo)", mute: "Tipka za utišavanje", phone: "za mobitel",
  lowCutSw: "Low-cut na mikrofonu", off: "Isključeno", padSw: "Prigušenje (PAD)", stepSw: "Prekidač nivoa", boostSw: "Pojačanje visokih (High Boost)",
  boostTip: "Vraća visoke tonove koje pojedu krzneni vjetrobran i udaljenost.",
  lc150: "Visok low-cut skida vjetar i udarce, ali glas postaje malo tanji.",
  padTip: "⚠ Vrlo glasan izvor: uključi PAD, inače izobliči već sam mikrofon – to ne spašava nikakav regulator nivoa.",
  phantomTip: "Treba 48 V fantomsko napajanje: na kameri samo uz XLR adapter (npr. DMW-XLR2, XLR-K3M) ili snimač.",
  phoneTip: "Ovaj sistem je pravljen za mobitel – na kameri samo uz dodatni prijemnik/adapter.",
  rangeTip: "⚠ Udaljenost {x}: blizu granice dometa (tijelo i zidovi guše signal) – uključi interno snimanje u predajniku kao rezervu.",
  approx: "Podaci su približni, prema podacima proizvođača.",
};

const en: Txt = {
  nzBtn: "Minimise noise",
  nzmHead: "Less noise – this was done / this is what you do on the camera:",
  nzmBase: "ISO set to the base ISO {x} – that's where the camera is cleanest.",
  nzmRaise: "Low light: ISO set to {x} – as low as possible but bright enough.",
  nzmSecond: "Low light: ISO set to the second base ISO {x} (dual native) – cleaner than an ISO just below it.",
  nzmNd: "ND filter {x}, so base ISO, aperture and shutter can stay.",
  nzmOpen: "Aperture opened to {x} – more light on the sensor (less depth of field).",
  nzmLight: "⚠ Still about {x} stops of light missing: add LED/window light or a faster lens – otherwise noise remains.",
  nzmEttr: "Log: exposed about +1.3 stops brighter (ETTR) – pull it down in post, the ETTR preview is on.",
  nzmShutterP: "Shutter {x} (handheld limit about {y}).",
  nzmTripod: "⚠ Still too dark for handheld: tripod, flash or more light.",
  nzmCheck: "Result: see the noise and exposure readouts in the status bar.",
  isoExtShort: "extended",
  isoExtInfo: "Extended low: L {x} – standard profile only, not in Log.",
  isoExt: "Extended ISO L {x}: below the base ISO {y} – about 1 stop less highlight range. Fine for sun without ND, otherwise prefer an ND filter.",
  isoRange: "{x}: ISO {y} – the minimum is the base ISO in the standard profile (e.g. in sunshine).",
  isoLog: "Log base ISO: {x} – below that less dynamic range.",
  dmAuto: "AUTO: the camera switches itself – below ISO {y} the low circuit (base {x}), from there on the high one. Right for most shooting.",
  dmLow: "LOW: always the low circuit (base {x}) – maximum dynamic range in daylight. Above about {y} it gets much noisier.",
  dmHigh: "HIGH: always the high circuit – lowest ISO is {y}. For night, interiors and low light: clean image at high ISO.",
  dmLowWarn: "ISO {x} on the LOW circuit: more noise than needed – switch to AUTO or HIGH (base {y}).",
  isoDual: "Dual native ISO: {x} – clean again on the second base value (little noise).",
  exHead: "Correctly exposed – this was done / this is what you do on the camera:",
  exAperture: "Aperture stays {x} (sets depth of field and look).",
  exShutterV: "Shutter stays {x} (180° rule: double the frame rate).",
  exShutterP: "Shutter set to {x}.",
  exIsoP: "ISO {x}.",
  exIsoV: "ISO set to {x} (as low as possible = little noise).",
  exIsoAuto: "ISO is on Auto – the camera adjusts it.",
  exNd: "ND filter {x} in front of the lens – cuts light without changing aperture or shutter.",
  exNoNd: "No ND filter needed.",
  exDark: "⚠ {x} stops of light missing: open the aperture, raise ISO or add light (LED, window) – otherwise it gets noisy.",
  exLog: "{x}: base ISO {y}. For clean shadows expose +1 to +2 stops brighter (ETTR) and pull it down in post.",
  exShake: "⚠ Shutter slower than 1/focal length – switch on stabilisation or use a tripod.",
  exCheckV: "Check: zebras/histogram – face around 70 % (Rec.709), in Log skin at the maker's value.",
  exCheckP: "Check the histogram: highlights must not touch the right edge.",
  expOk: "Exposure OK", expOver: "Over-exposed", expUnder: "Under-exposed", expClip: "Clipping",
  nzHead: "Image noise & ETTR", nzOn: "Simulate noise", nzEttr: "ETTR preview: pull down in post",
  nzChip: { low: "Noise low", mid: "Noise medium", high: "Noise high" }, nzOffChip: "Noise off",
  nzStateOn: "Noise simulation on: noise rises with ISO, low light and under-exposure – in Log it shows most in the shadows.",
  nzStateOff: "Noise simulation off: the picture is cleaner than in reality.",
  nzUnder: "⚠ {x} stops under-exposed: brightening it in post brings the noise up too (like turning up a quiet recording).",
  nzEttrTip: "ETTR (Expose To The Right): in Log expose +1 to +2 stops brighter, don't clip the highlights, pull it down in post – the noise goes down with it.",
  nzEttrGood: "✓ Exposed +{x} stops and pulled down in post: clean shadows, rich colour.",
  nzClip: "⚠ Highlights clip (beyond +{x} stops) – set zebras to clip level and stop down until the stripes disappear.",
  nzLog: "Log rule of thumb: expose for the noise, grade for the look.",
  windSw: "WIND CUT on the mic", noiseSw: "NOISE CUT on the mic", limSwMic: "Limiter on the mic (LMT)", dialSw: "Level dial on the mic",
  safetyChip: "Safety channel {x} dB", camHead: "Settings in the camera menu", appHead: "Settings in the receiver / app",
  camKeys: { pattern: "Pickup pattern", f32: "32-bit float recording", ch4: "4-channel recording (backup)", level: "Recording level", wind: "Wind noise reduction", rate: "Sample rate 48 / 96 kHz", hp: "Headphone volume", power: "Power through the camera shoe" },
  appKeys: { gain: "Gain", hpf: "High-pass filter", f32: "32-bit float onboard", tc: "Timecode", safety: "Safety track", stereo: "Mono / Stereo / Merged", led: "LED brightness", nc: "Noise cancelling", rec: "Onboard recording", fw: "Firmware update" },
  noiseTip: "NOISE CUT removes steady noise (air conditioning, fans) – on HI voices can sound slightly artificial.",
  windTip: "WIND CUT on HI cuts low frequencies harder – good outdoors in wind, indoors voices sound thinner.",
  micLimTip: "The limiter in the mic catches loud peaks before they reach the camera (AUTO: only when needed).",
  dialTip: "Use the dial to fine-tune the level on top of the GAIN switch.",
  lensFx: "Switches & functions on the lens",
  micFx: "Switches & functions on the microphone",
  ois: "Optical stabiliser in the lens", afmf: "AF/MF switch", limiter: "Focus limiter", apRing: "Aperture ring", declick: "De-clickable aperture ring",
  clutch: "Pull-back focus ring (MF clutch)", fn: "Focus-hold / Fn button", ctrlRing: "Control ring (assignable)", zoomLock: "Zoom lock",
  pz: "Power zoom", sealed: "Dust and splash protection", mfd: "Closest focus {x}", weight: "{x} g",
  oisSw: "Lens stabiliser on", mfSw: "AF/MF switch set to MF", limSw: "Focus range", limFull: "FULL – whole range", limFar: "{x} – ∞ (faster AF)",
  oisOn: "✓ Lens and sensor stabilisers work together.", oisOff: "Lens stabiliser off – right on a tripod; handheld it shakes more at long focal lengths.",
  tooClose: "⚠ Subject at {x} – this lens only focuses from {y}. Step back or use a macro lens.",
  limBlock: "⚠ Focus limiter at {x} – ∞: the subject at {y} is too close, autofocus cannot find it. Switch to FULL.",
  limOk: "✓ Autofocus only searches from {x} – faster and without hunting on distant subjects.",
  declickTip: "For video de-click the aperture ring: the iris moves smoothly and silently.",
  conn: "Connector: {x}", pwPlugin: "Powered by the camera (plug-in power)", pwBattery: "Built-in battery", pwPhantom: "48 V phantom power", pwShoe: "Powered through the camera shoe", pwAa: "Batteries (AA/AAA)",
  hours: "approx. {x} h", range: "Range approx. {x} m", monitor: "Headphone output", usb: "USB microphone", autoPower: "switches on with the camera", timecode: "Timecode",
  gainAssist: "GainAssist (automatic level)", mute: "Mute button", phone: "for smartphones",
  lowCutSw: "Low cut on the microphone", off: "Off", padSw: "Attenuation (PAD)", stepSw: "Level switch", boostSw: "High-frequency boost",
  boostTip: "Restores the highs that a furry windshield and distance take away.",
  lc150: "A high low-cut removes wind and handling noise but makes voices a little thinner.",
  padTip: "⚠ Very loud source: switch on the PAD, otherwise the microphone itself distorts – no level control can fix that.",
  phantomTip: "Needs 48 V phantom power: on the camera only with an XLR adapter (e.g. DMW-XLR2, XLR-K3M) or a recorder.",
  phoneTip: "This system is built for phones – on a camera only with an extra receiver/adapter.",
  rangeTip: "⚠ {x} away: close to the range limit (bodies and walls absorb the signal) – switch on internal recording in the transmitter as a backup.",
  approx: "Figures are approximate, from the makers' data.",
};

const sr: Txt = {
  ...bs,
  nzmRaise: "Malo svetla: ISO na {x} – što niže, ali dovoljno svetlo.",
  nzmSecond: "Malo svetla: ISO na drugi bazni ISO {x} (Dual Native) – čistije nego ISO malo ispod toga.",
  nzmOpen: "Blenda otvorena na {x} – više svetla na senzor (ali manja dubinska oštrina).",
  nzmLight: "⚠ Fali još oko {x} blende svetla: dodaj LED/prozor ili svetliji objektiv – inače ostaje šum.",
  nzmEttr: "Log: eksponirano oko +1,3 blende svetlije (ETTR) – u postu povuci dole, ETTR pregled je uključen.",
  nzmTripod: "⚠ Još pretamno za iz ruke: stativ, blic ili više svetla.",
  mfd: "Najbliži fokus {x}", limFull: "FULL – ceo opseg", sealed: "Zaštita od prašine i prskanja",
  boostTip: "Vraća visoke tonove koje pojedu krzneni vetrobran i udaljenost.", lc150: "Visok low-cut skida vetar i udarce, ali glas postaje malo tanji.",
  phoneTip: "Ovaj sistem je pravljen za mobilni – na kameri samo uz dodatni prijemnik/adapter.", phone: "za mobilni",
  rangeTip: "⚠ Udaljenost {x}: blizu granice dometa (telo i zidovi guše signal) – uključi interno snimanje u predajniku kao rezervu.",
  camKeys: { ...bs.camKeys, pattern: "Karakteristika usmerenosti", wind: "Smanjenje šuma vetra" },
  nzUnder: "⚠ {x} blende podeksponirano: kad u postu posvetliš, šum dođe s tim (kao kad tihi snimak pojačaš).",
  nzEttrTip: "ETTR (Expose To The Right): u Logu eksponiraj +1 do +2 blende svetlije, ne pali svetla (clipping), u postu povuci dole – šum ide dole s tim.",
  nzEttrGood: "✓ Eksponirano +{x} blende i povučeno dole u postu: čiste senke, bogate boje.",
  nzClip: "⚠ Svetla se pale (clipping, preko +{x} blende) – zebru stavi na clip-nivo i zatvaraj blendu dok pruge ne nestanu.",
  nzStateOn: "Simulacija šuma uključena: šum raste s ISO-om, slabim svetlom i podeksponiranjem – u Logu se naročito vidi u senkama.",
  nzStateOff: "Simulacija šuma isključena: slika je čistija nego u stvarnosti.",
  nzEttr: "ETTR pregled: povuci dole u postu",
  exAperture: "Blenda ostaje {x} (određuje dubinsku oštrinu i izgled).",
  exShutterP: "Brzina zatvarača postavljena na {x}.",
  exNd: "ND filter {x} ispred objektiva – smanjuje svetlo bez menjanja blende i zatvarača.",
  exDark: "⚠ Fali {x} blende svetla: otvori blendu, podigni ISO ili dodaj svetlo (LED, prozor) – inače će biti šuma.",
  exLog: "{x}: od baznog ISO {y}. Za čiste senke eksponiraj +1 do +2 blende svetlije (ETTR) i u postu povuci dole.",
  exCheckP: "Provera: pogledaj histogram, svetla ne smeju udariti u desnu ivicu.",
  isoRange: "{x}: ISO {y} – minimum je bazni ISO u standardnom profilu (npr. na suncu).",
  isoExtInfo: "Prošireno nadole: L {x} – samo u standardnom profilu, ne u Logu.",
  isoExt: "Prošireni ISO L {x}: ispod baznog ISO {y} – oko 1 blenda manje dinamike u svetlima. Dobro za sunce bez ND-a, inače radije ND filter.",
  dmAuto: "AUTO: kamera sama prebacuje – ispod ISO {y} niski krug (baza {x}), od te vrednosti visoki. Ispravno za većinu snimanja.",
  dmLow: "LOW: uvek niski krug (baza {x}) – najveća dinamika na dnevnom svetlu. Iznad oko {y} ima znatno više šuma.",
  dmHigh: "HIGH: uvek visoki krug – najmanji ISO je {y}. Za noć, enterijer i malo svetla: čista slika na visokom ISO.",
  dmLowWarn: "ISO {x} u LOW krugu: više šuma nego što treba – prebaci na AUTO ili HIGH (baza {y}).",
  isoDual: "Dual Native ISO: {x} – na drugoj baznoj vrednosti opet čisto (malo šuma).",
  exCheckV: "Provera: zebra/histogram – lice oko 70 % (Rec.709), u Logu ten po vrednosti proizvođača.",
  windTip: "WIND CUT na HI jače seče niske frekvencije – dobro napolju na vetru, unutra glas zvuči tanje.",
  noiseTip: "NOISE CUT skida ravnomeran šum (klima, ventilator) – na HI glas može zvučati malo veštački.",
  micLimTip: "Limiter u mikrofonu hvata glasne vrhove pre nego odu u kameru (AUTO: samo kad treba).",
};

const TXT: Record<string, Txt> = { de, bs, sr, en };
export const fxText = (lang: string): Txt => TXT[lang] ?? en;
