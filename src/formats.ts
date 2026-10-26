// Recording formats, approximate bitrates and card space.

export const RESOLUTIONS = [
  { id: "fhd", label: "Full HD 1920×1080", px: 1920 * 1080 },
  { id: "uhd", label: "4K UHD 3840×2160", px: 3840 * 2160 },
  { id: "c4k", label: "C4K 4096×2160", px: 4096 * 2160 },
  { id: "6k", label: "6K", px: 5760 * 3240, needs: "k6" },
  { id: "og", label: "Open Gate 3:2 (~5.8K)", px: 5760 * 3840, needs: "openGate" },
  { id: "8k", label: "8K 7680×4320", px: 7680 * 4320, needs: "k8" },
] as const;
export type ResolutionId = (typeof RESOLUTIONS)[number]["id"];

/** Mbit/s at 4K UHD 25p; scaled by pixels and frame rate. */
export const CODECS = [
  { id: "h264", label: "H.264 8-bit 4:2:0 Long GOP", mbps: 100, cap: 200, gop: true },
  { id: "h264_422", label: "H.264 10-bit 4:2:2 Long GOP", mbps: 150, cap: 400, gop: true },
  { id: "h264i", label: "H.264 10-bit 4:2:2 All-I", mbps: 400, cap: 1900, gop: false },
  { id: "h265", label: "H.265 10-bit 4:2:0", mbps: 100, cap: 400, gop: true },
  { id: "h265_422", label: "H.265 10-bit 4:2:2", mbps: 140, cap: 500, gop: true },
  { id: "pr422", label: "Apple ProRes 422", mbps: 490, cap: 4000, gop: false },
  { id: "pr422hq", label: "Apple ProRes 422 HQ", mbps: 740, cap: 6000, gop: false },
  { id: "prraw", label: "Apple ProRes RAW", mbps: 1000, cap: 8000, gop: false },
  { id: "nraw", label: "N-RAW", mbps: 1100, cap: 8000, gop: false },
  { id: "crm", label: "Cinema RAW Light", mbps: 1300, cap: 8000, gop: false },
  { id: "xocn", label: "X-OCN (16-bit RAW)", mbps: 1200, cap: 8000, gop: false },
] as const;
export type CodecId = (typeof CODECS)[number]["id"];

export type Container = { id: string; label: string; codecs: CodecId[]; factor?: number };

const PANA_PRORES = ["pana-s1ii", "pana-s1rii", "pana-gh7", "pana-gh6", "pana-g9ii", "pana-s5iix"];
const PANA_LITE = ["pana-s1ii", "pana-s1rii", "pana-s5ii", "pana-s5iix", "pana-s9", "pana-gh7", "pana-g9ii"];
const NIKON_PRO = ["nikon-z9", "nikon-z8", "nikon-z6iii", "nikon-z5ii"];
const CANON_RAW = ["canon-r1", "canon-r3", "canon-r5ii"];

/** Recording file formats and the codecs each one offers on this camera. */
export function containersFor(cam: { id: string; brand: string } | undefined): Container[] {
  const id = cam?.id ?? "";
  switch (cam?.brand) {
    case "Panasonic": {
      const pr: CodecId[] = PANA_PRORES.includes(id) ? ["pr422", "pr422hq", "prraw"] : [];
      const list: Container[] = [
        { id: "mov", label: "MOV", codecs: ["h264", "h264_422", "h264i", "h265", ...pr] },
        { id: "mp4", label: "MP4", codecs: ["h264", "h265"] },
      ];
      if (PANA_LITE.includes(id)) list.push({ id: "mp4lite", label: "MP4 (Lite)", codecs: ["h265"], factor: 0.6 });
      return list;
    }
    case "Sony": {
      const list: Container[] = [
        { id: "xavcs", label: "XAVC S (MP4)", codecs: ["h264", "h264_422"] },
        { id: "xavchs", label: "XAVC HS (MP4)", codecs: ["h265", "h265_422"] },
        { id: "xavcsi", label: "XAVC S-I (MP4)", codecs: ["h264i"] },
      ];
      if (id === "sony-fx5")
        list.push({ id: "prores", label: "ProRes (MOV)", codecs: ["pr422", "pr422hq"] }, { id: "xocn", label: "X-OCN (MXF)", codecs: ["xocn"] });
      return list;
    }
    case "Canon": {
      const list: Container[] = [{ id: "mp4", label: "MP4", codecs: ["h264", "h265_422"] }];
      if (CANON_RAW.includes(id)) list.push({ id: "crm", label: "RAW (.CRM)", codecs: ["crm"] });
      return list;
    }
    case "Nikon": {
      if (id === "nikon-zfc") return [{ id: "mov", label: "MOV", codecs: ["h264"] }, { id: "mp4", label: "MP4", codecs: ["h264"] }];
      const pro = NIKON_PRO.includes(id);
      const list: Container[] = [
        { id: "mov", label: "MOV", codecs: pro ? ["h264", "h265", "pr422hq", "prraw"] : ["h264", "h265"] },
        { id: "mp4", label: "MP4", codecs: ["h264", "h265"] },
      ];
      if (pro) list.push({ id: "nev", label: "N-RAW (.NEV)", codecs: ["nraw"] });
      return list;
    }
    case "DJI":
      return [{ id: "mp4", label: "MP4", codecs: ["h264", "h265"] }, { id: "mov", label: "MOV", codecs: ["h264", "h265"] }];
    case "Insta360":
      return [{ id: "mp4", label: "MP4 / INSV", codecs: ["h264", "h265"] }];
  }
  return [
    { id: "mov", label: "MOV", codecs: ["h264", "h265", "pr422", "pr422hq"] },
    { id: "mp4", label: "MP4", codecs: ["h264", "h265"] },
  ];
}

const UHD = 3840 * 2160;

export function bitrate(res: ResolutionId, codec: CodecId, fps: number, factor = 1) {
  const r = RESOLUTIONS.find((x) => x.id === res)!;
  const c = CODECS.find((x) => x.id === codec)!;
  // long-GOP codecs grow slower than linearly with resolution and frame rate
  const exp = c.gop ? 0.7 : 1;
  const v = c.mbps * factor * Math.pow(r.px / UHD, exp) * Math.pow(fps / 25, exp);
  return Math.round(Math.min(v, c.cap) / 10) * 10;
}

/** Card class needed for a bitrate in Mbit/s. */
export function cardFor(mbps: number) {
  if (mbps <= 200) return "SD V30";
  if (mbps <= 400) return "SD V60";
  if (mbps <= 700) return "SD V90";
  if (mbps <= 3000) return "CFexpress Type A/B";
  return "CFexpress Type B / SSD";
}

/** Framing guides drawn on the monitor (width / height). */
export const GUIDES = [
  { id: "none", ratio: 0 },
  { id: "9x16", ratio: 9 / 16 },
  { id: "4x5", ratio: 4 / 5 },
  { id: "1x1", ratio: 1 },
  { id: "239", ratio: 2.39 },
] as const;
export type GuideId = (typeof GUIDES)[number]["id"];
