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
  { id: "h264", label: "H.264 8-bit 4:2:0", mbps: 100, cap: 200 },
  { id: "h265", label: "H.265 10-bit 4:2:0", mbps: 100, cap: 400 },
  { id: "h265i", label: "H.265 10-bit 4:2:2 All-I", mbps: 400, cap: 1900 },
  { id: "pr422", label: "Apple ProRes 422", mbps: 490, cap: 4000 },
  { id: "pr422hq", label: "Apple ProRes 422 HQ", mbps: 740, cap: 6000 },
  { id: "raw", label: "ProRes RAW / BRAW", mbps: 1100, cap: 8000 },
] as const;
export type CodecId = (typeof CODECS)[number]["id"];

const UHD = 3840 * 2160;

export function bitrate(res: ResolutionId, codec: CodecId, fps: number) {
  const r = RESOLUTIONS.find((x) => x.id === res)!;
  const c = CODECS.find((x) => x.id === codec)!;
  // long-GOP codecs grow slower than linearly with resolution and frame rate
  const exp = codec === "h264" || codec === "h265" ? 0.7 : 1;
  const v = c.mbps * Math.pow(r.px / UHD, exp) * Math.pow(fps / 25, exp);
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
