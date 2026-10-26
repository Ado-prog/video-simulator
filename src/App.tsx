import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Monitor, { type SubjectKind, ROW_GAP, rowCount } from "./Monitor";
import { MICS, MIC_BRANDS, INTERNAL_MIC, SOURCES, type SourceId, type PatternId, audioLevels, autoGain, effectiveMic } from "./audio";
import { stylesFor, makerLutsFor, CREATIVE_LUTS, NEUTRAL_LOOK } from "./looks";
import { factsFor, slotsFor, sensorDR, SCENE_DR, pixelPitch, RONINS, RONIN_MODES, type RoninId, type RoninMode } from "./camdata";
import { RESOLUTIONS, CODECS, MEDIA, bitrate, containersFor, mediaClass, minutesOn, type ResolutionId, type CodecId } from "./formats";
import { zebraSpecFor, zebraBands, FRAME_RATIOS, FRAME_COLORS, type ZebraMode, type FrameRatioId, type FrameColor } from "./zebra";
import { sunDay, PLACES } from "./sun";
import { PHOTOS, COUPLES, DEFAULT_COUPLE, byKind, GUEST_MEN, GUEST_WOMEN, type PersonPhoto } from "./peoplePhotos";
import PhotoDiagram from "./PhotoDiagram";
import { LensArt, IrisArt, CameraArt, cameraKind } from "./GearArt";
import { DICT, LANGUAGES, fill, loadLang, saveLang, type Lang } from "./i18n";
import { BRANDS, CAMERAS, lensesForCamera, maxApertureAt, logProfilesFor, type Lens } from "./gear";
import {
  SENSORS,
  SENSOR_KEYS,
  cocOf,
  cropOf,
  videoFrameHeight,
  depthOfField,
  stopsFrom,
  formatMeters,
} from "./optics";
import {
  SCENES,
  ISOS,
  SHUTTER_SPEEDS,
  correctShutter,
  nearestShutter,
  WB_MODES,
  type WbMode,
  formatShutter,
  cameraEV,
  whiteBalanceKelvin,
  colorCast,
  VIDEO_SYSTEMS,
  type VideoSystem,
  DEFAULT_FPS,
  videoShutters,
  shutter180,
  isFlickerSafe,
  autoIso,
  ND_FILTERS,
  BACKDROPS,
  PHOTO_BACKDROPS,
  type BackdropKind,
  CPL_LOSS,
  pickNd,
  nearestIso,
} from "./lighting";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const formatMinutes = (min: number) => (min >= 120 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min` : `${min} min`);

// Timeline frame rates offered by Final Cut Pro and DaVinci Resolve
const TIMELINE_RATES = [23.976, 24, 25, 29.97, 30, 47.952, 48, 50, 59.94, 60, 95.904, 96, 100, 119.88, 120];
const rateLabel = (r: number) => `${Number.isInteger(r) ? r : r.toFixed(2)}p`;
/** NTSC cameras record 24/30/60/120 as 23.976/29.97/59.94/119.88. */
const realFps = (sys: VideoSystem, rate: number) =>
  sys === "NTSC" && rate !== 24 ? Math.round((rate * 1000) / 1001 * 1000) / 1000 : sys === "NTSC" ? 23.976 : rate;

// Focus distance slider runs on a log scale from 0.3 m to 30 m.
const D_MIN = 0.3;
const D_MAX = 30;
const toSlider = (m: number) => Math.round((Math.log(m / D_MIN) / Math.log(D_MAX / D_MIN)) * 1000);
const fromSlider = (v: number) => D_MIN * Math.pow(D_MAX / D_MIN, v / 1000);

const DEFAULT_CAMERA = "";
const DEFAULT_LENS = "";

type Theme = "system" | "light" | "dark";

function loadTheme(): Theme {
  try {
    const v = localStorage.getItem("video-sim-theme");
    if (v === "light" || v === "dark") return v;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(loadLang);
  const t = DICT[lang];
  const setLang = (l: Lang) => {
    setLangState(l);
    saveLang(l);
  };
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t.appTitle} · Mustafi Studio`;
  }, [lang, t.appTitle]);

  const [theme, setTheme] = useState<Theme>(loadTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("video-sim-theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);

  // Phones: taller side view so its labels stay readable
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(max-width: 600px)").matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(max-width: 600px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const [shootMode, setShootMode] = useState<"photo" | "video">("video");
  const isVideo = shootMode === "video";

  // ── Resizable split between the side view and the monitor column
  const studioRef = useRef<HTMLElement>(null);
  const [sideFrac, setSideFrac] = useState(() => {
    try {
      const v = Number(localStorage.getItem("video-sim-side"));
      if (v >= 0.2 && v <= 0.65) return v;
    } catch {
      /* storage unavailable */
    }
    return 1 / 3;
  });
  const saveSide = (f: number) => {
    const v = clamp(f, 0.2, 0.65);
    setSideFrac(v);
    try {
      localStorage.setItem("video-sim-side", String(v));
    } catch {
      /* storage unavailable */
    }
  };
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = studioRef.current;
    if (!el) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      saveSide((rect.right - ev.clientX) / rect.width);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("is-resizing");
    };
    document.body.classList.add("is-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── Camera & lens
  const [cameraId, setCameraId] = useState(DEFAULT_CAMERA);
  const [lensId, setLensId] = useState(DEFAULT_LENS);
  const [manualSensor, setManualSensor] = useState("35mm (full frame)");
  const camera = CAMERAS.find((c) => c.id === cameraId);
  const lenses = lensesForCamera(camera);
  const lens = lenses.find((l) => l.id === lensId);
  const sensorKey = lens?.sensor ?? camera?.sensor ?? manualSensor;
  const sensor = SENSORS[sensorKey] ?? SENSORS["35mm (full frame)"];
  const coc = cocOf(sensor);
  const crop = cropOf(sensor);
  const frameH = videoFrameHeight(sensor);
  const facts = factsFor(camera);

  // ── Optics
  const [focal, setFocal] = useState(50);
  const [aperture, setAperture] = useState(2.8);
  const [focusM, setFocusM] = useState(3);
  const [subject, setSubject] = useState<SubjectKind>("couple");
  // real people (photos) or the drawn figures
  const [peopleMode, setPeopleMode] = useState<"photo" | "drawn">("drawn");
  const [coupleN, setCoupleN] = useState(0);
  const [singleN, setSingleN] = useState(0);
  const couplePhoto = PHOTOS.find((p) => p.n === coupleN && p.kind === "couple") ?? DEFAULT_COUPLE;
  const singlePhoto = PHOTOS.find((p) => p.n === singleN) ?? GUEST_MEN[0] ?? byKind("man")[0];
  const pic = (p?: PersonPhoto) => (p ? { href: `./${p.file}`, w: p.w, h: p.h, cut: p.cut } : undefined);
  const people =
    peopleMode === "photo"
      ? {
          couple: pic(couplePhoto),
          single: pic(singlePhoto),
          singleHeight: singlePhoto?.kind === "man" ? 1.8 : 1.68,
          men: (GUEST_MEN.length >= 3 ? GUEST_MEN : byKind("man")).map((p) => pic(p)!),
          women: (GUEST_WOMEN.length >= 3 ? GUEST_WOMEN : byKind("woman")).map((p) => pic(p)!),
        }
      : undefined;

  const isPrime = !!lens && lens.minFocal === lens.maxFocal;
  const fMin = lens ? lens.minFocal : 3;
  const fMax = lens ? lens.maxFocal : 400;
  const apMin = lens ? maxApertureAt(lens, focal) : 0.95;
  const stops = useMemo(() => stopsFrom(apMin), [apMin]);
  const stopIndex = stops.reduce(
    (best, n, i) => (Math.abs(n - aperture) < Math.abs(stops[best] - aperture) ? i : best),
    0
  );

  const applyLens = (l: Lens) => {
    setLensId(l.id);
    const f = clamp(focal, l.minFocal, l.maxFocal);
    setFocal(f);
    const minAp = maxApertureAt(l, f);
    setAperture((a) => (l.fixedAperture ? minAp : Math.max(a, minAp)));
  };
  const selectCamera = (id: string) => {
    setCameraId(id);
    setLensId("");
    const cam = CAMERAS.find((c) => c.id === id);
    if (cam?.fixedLens) {
      const first = lensesForCamera(cam)[0];
      if (first) applyLens(first);
    }
    const logs = logProfilesFor(cam);
    if (!logs.some((x) => x.id === profileId)) setProfileId("standard");
  };
  const selectLens = (id: string) => {
    const l = lenses.find((x) => x.id === id);
    if (l) applyLens(l);
    else setLensId("");
  };
  const changeFocal = (f: number) => {
    setFocal(f);
    if (lens) setAperture((a) => Math.max(a, maxApertureAt(lens, f)));
  };

  const dof = depthOfField(focal, aperture, focusM * 1000, coc);
  const totalMM = dof.far - dof.near;
  const eqFocal = Math.round(focal * crop);
  const diffractionAt = coc / 0.001342; // Airy disk ≈ 2.44 · 550 nm · N
  const canHyperfocal = dof.hyperfocal / 1000 <= D_MAX;

  // ── Light
  const [sceneId, setSceneId] = useState("hall");
  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
  const [boost, setBoost] = useState(0);
  const [lightK, setLightK] = useState(scene.kelvin);
  const [backdropId, setBackdropId] = useState("garden");
  const bd = BACKDROPS[backdropId];
  const viewPalette = bd ? { ...scene.palette, ...bd.palette } : scene.palette;
  const backdropKind: BackdropKind = bd ? bd.kind : scene.palette.indoor ? "curtain" : "trees";
  const selectScene = (id: string) => {
    setSceneId(id);
    const s = SCENES.find((x) => x.id === id);
    if (s) setLightK(s.kelvin);
    setBoost(0);
  };

  // ── Filters
  const [ndId, setNdId] = useState("none");
  const [vnd, setVnd] = useState(3);
  const [cplOn, setCplOn] = useState(false);
  const [cplRot, setCplRot] = useState(90);
  const [uvOn, setUvOn] = useState(false);
  const nd = ND_FILTERS.find((n) => n.id === ndId) ?? ND_FILTERS[0];
  const ndStops = ndId === "vnd" ? vnd : nd.stops;
  const filterStops = ndStops + (cplOn ? CPL_LOSS : 0);
  const cplEffect = cplOn ? Math.pow(Math.sin((cplRot * Math.PI) / 180), 2) : 0;
  const filterTag = [ndId === "vnd" ? `VND ${vnd}` : ndId !== "none" ? nd.label : "", cplOn ? "CPL" : "", uvOn ? "UV" : ""]
    .filter(Boolean)
    .join(" · ");

  // ── Video
  const [vSystem, setVSystem] = useState<VideoSystem>("PAL");
  const [fps, setFps] = useState(25);
  const [shutter, setShutter] = useState(1 / 50);
  const [isoAuto, setIsoAuto] = useState(true);
  const [iso, setIso] = useState(800);
  const [wbMode, setWbMode] = useState<WbMode>("auto");
  const [wbK, setWbK] = useState(5600);
  const [profileId, setProfileId] = useState("standard");
  const [lutId, setLutId] = useState(""); // "" = first manufacturer LUT, "none" = flat Log
  const [styleId, setStyleId] = useState("");
  const logs = logProfilesFor(camera);
  const logProfile = logs.find((x) => x.id === profileId);
  const styles = stylesFor(camera);
  const style = styles.find((x) => x.id === styleId) ?? styles[0];
  const makerLuts = logProfile ? makerLutsFor(logProfile.name) : [];
  const creativeLut = CREATIVE_LUTS.find((x) => x.id === lutId);
  const makerLut = makerLuts.find((x) => x.id === lutId) ?? makerLuts[0];
  const lutNone = lutId === "none";
  const lutValue = lutNone ? "none" : creativeLut ? creativeLut.id : makerLut?.id ?? "none";
  const minIso = logProfile?.minIso ?? 100;
  const baseIsos = logProfile && factsFor(camera).dualIso ? factsFor(camera).dualIso! : [];
  const isoChoices = [...new Set([minIso, ...baseIsos, ...ISOS.filter((v) => v >= minIso)])].sort((a, b) => a - b);

  const changeVideo = (sys: VideoSystem, rate: number) => {
    // a new system resets the timeline; a normal frame rate (≤ 30p) puts the timeline on the same rate,
    // higher rates keep the timeline so they play back as slow motion
    if (sys !== vSystem) setTimelineFps(sys === "NTSC" ? 29.97 : 25);
    else if (rate <= 30) setTimelineFps(realFps(sys, rate));
    setVSystem(sys);
    setFps(rate);
    setShutter(shutter180(sys, rate));
  };

  // photo settings
  const [expMode, setExpMode] = useState<"M" | "A">("M");
  const [photoShutter, setPhotoShutter] = useState(1 / 250);
  const [photoIso, setPhotoIso] = useState(800);

  // ── Monitor assists
  const zSpec = zebraSpecFor(camera);
  const [zebraMode, setZebraMode] = useState<ZebraMode>("off");
  const [zebraLevels, setZebraLevels] = useState<Record<string, { z1: number; z2: number; w: number }>>({});
  const zl = zebraLevels[zSpec.brand] ?? { z1: zSpec.z1.def, z2: zSpec.z2?.def ?? 100, w: zSpec.z2?.defWidth ?? zSpec.z1.defWidth ?? 5 };
  const setZl = (patch: Partial<typeof zl>) => setZebraLevels((all) => ({ ...all, [zSpec.brand]: { ...zl, ...patch } }));
  const zMode: ZebraMode = !zSpec.z2 && zebraMode !== "off" ? "z1" : !zSpec.both && zebraMode === "z12" ? "z1" : zebraMode;
  const zWidth = zSpec.z1.kind === "band" ? zSpec.z1.defWidth ?? 5 : zl.w;
  const [falseColor, setFalseColor] = useState(false);
  const [wfmOn, setWfmOn] = useState(false);
  const [wfmType, setWfmType] = useState<"wave" | "vector">("wave");
  const [histogram, setHistogram] = useState(false);
  const [peaking, setPeaking] = useState(false);
  const [frameOn, setFrameOn] = useState(false);
  type Marker = { on: boolean; ratio: FrameRatioId; color: FrameColor };
  const [frameMarkers, setFrameMarkers] = useState<Marker[]>([
    { on: true, ratio: "2.39", color: "white" },
    { on: false, ratio: "9:16", color: "yellow" },
    { on: false, ratio: "4:5", color: "green" },
  ]);
  const setMarker = (i: number, patch: Partial<Marker>) =>
    setFrameMarkers((all) => all.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const markerCount = facts.frames ?? 1;
  const activeMarkers = frameMarkers.slice(0, markerCount).filter((m) => m.on);
  const [frameMask, setFrameMask] = useState(50);

  // ── Recording & movement (video)
  const [motion, setMotion] = useState<"static" | "slow" | "fast" | "walk" | "ronin" | "car">("static");
  const [roninId, setRoninId] = useState<RoninId>("rs4");
  const [roninMode, setRoninMode] = useState<RoninMode>("pf");
  const ronin = RONINS.find((r) => r.id === roninId) ?? RONINS[1];
  const [stab, setStab] = useState<"off" | "ibis" | "eis" | "boost">("ibis");
  const [timelineFps, setTimelineFps] = useState(25);
  const camRate = realFps(vSystem, fps);
  const tlRatio = camRate / timelineFps;
  const [resId, setResId] = useState<ResolutionId>("uhd");
  const [codecId, setCodecId] = useState<CodecId>("h265");
  const [containerId, setContainerId] = useState("");
  const containers = containersFor(camera);
  const container = containers.find((c) => c.id === containerId) ?? containers[0];
  const codec: CodecId = container.codecs.includes(codecId) ? codecId : container.codecs.includes("h265") ? "h265" : container.codecs[0];
  const stabCrop = isVideo ? (stab === "eis" ? 1.1 : stab === "boost" ? 1.25 : 1) : 1;
  const hfov = 2 * Math.atan((sensor.width / stabCrop) / 2 / focal) * (180 / Math.PI);
  const panSpeed = motion === "ronin" ? RONIN_MODES[roninMode] : { static: 0, slow: 10, fast: 60, walk: 15, car: 90 }[motion]; // degrees per second
  const leanDeg = isVideo && facts.readout > 0
    ? (Math.atan(((panSpeed * facts.readout) / 1000 / hfov) * (16 / 9)) * 180) / Math.PI
    : 0;
  const resolutions = RESOLUTIONS.filter((r) => !("needs" in r) || facts[r.needs]);
  const res = resolutions.find((r) => r.id === resId) ?? resolutions[1];
  const mbps = bitrate(res.id, codec, fps, container.factor);

  // ── Flash, shutter type, bracketing (photo)
  const [flashMode, setFlashMode] = useState<"off" | "ttl" | "hss">("off");
  const [shutterType, setShutterType] = useState<"mech" | "efc" | "e">("mech");
  const [bracketId, setBracketId] = useState<"off" | "3x1" | "5x1" | "3x2" | "5x2">("off");

  // ── Sun planner
  const [placeId, setPlaceId] = useState("zrh");
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(null);
  const [geoFail, setGeoFail] = useState(false);
  const [sunDate, setSunDate] = useState(() => new Date().toISOString().slice(0, 10));
  const place = PLACES.find((x) => x.id === placeId) ?? PLACES[0];
  const sunPos = placeId === "geo" && geo ? geo : place;
  const sunTz = placeId === "geo" ? Intl.DateTimeFormat().resolvedOptions().timeZone : place.tz;
  const [sy, sm, sdd] = sunDate.split("-").map(Number);
  const sun = sunDay(Date.UTC(sy, (sm || 1) - 1, sdd || 1), sunPos.lat, sunPos.lon);
  const hm = (ms?: number) =>
    ms ? new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", timeZone: sunTz }).format(ms) : "–";
  const span = (r?: [number, number]) => (r ? `${hm(r[0])}–${hm(r[1])}` : "–");
  const locate = () => {
    if (!navigator.geolocation) return setGeoFail(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setPlaceId("geo");
        setGeoFail(false);
      },
      () => setGeoFail(true)
    );
  };

  const sceneEV = scene.ev + boost - filterStops;
  const activeLog = isVideo ? logProfile : undefined;
  const look = activeLog ? (lutNone ? NEUTRAL_LOOK : creativeLut?.look ?? makerLut?.look ?? NEUTRAL_LOOK) : style.look;
  const lutTag = lutNone ? "" : creativeLut ? ` + ${t[creativeLut.id]}` : " + LUT";
  const activeMinIso = isVideo ? minIso : 100;
  const effShutter = isVideo
    ? shutter
    : expMode === "A"
    ? clamp(correctShutter(sceneEV, aperture, photoIso), 1 / 8000, 30)
    : photoShutter;
  const auto = autoIso(sceneEV, aperture, effShutter, activeMinIso);
  const useAuto = isVideo && isoAuto;
  const effIso = isVideo ? (isoAuto ? auto.iso : Math.max(iso, minIso)) : photoIso;
  const exposureDelta = sceneEV - cameraEV(aperture, effShutter, effIso);
  const shakeLimit = Math.round(focal * crop);
  const shakeRisk = !isVideo && effShutter > 1 / shakeLimit;
  const camWbK = whiteBalanceKelvin(wbMode, lightK, wbK);
  const cast = colorCast(lightK, camWbK);
  const dualIso = isVideo && activeLog && facts.dualIso && facts.dualIso.length > 1 ? facts.dualIso : null;
  const onSecondBase = !!dualIso && effIso >= dualIso[1];
  // noise follows the highest base ISO at or below the chosen ISO
  const activeBase = dualIso ? [...dualIso].reverse().find((b) => effIso >= b) ?? dualIso[0] : 0;
  const noiseIso = onSecondBase ? (effIso * dualIso![0]) / activeBase : effIso;
  const grain = Math.min(0.45, Math.max(0, Math.log2(noiseIso / 100)) * 0.045 * Math.sqrt(crop));

  // photo checks
  const mains = VIDEO_SYSTEMS[vSystem].mainsHz;
  const syncLimit = facts.sync;
  const syncBad = !isVideo && flashMode === "ttl" && !!syncLimit && effShutter < syncLimit - 1e-9;
  const bandOk = 1 / (2 * mains);
  const banding = !isVideo && shutterType === "e" && facts.readout > 0 && scene.palette.indoor && effShutter < bandOk - 1e-9;
  const bands = Math.max(1, Math.round((facts.readout / 1000) * 2 * mains));
  const camDR = sensorDR(sensorKey) - Math.max(0, Math.log2((isVideo ? effIso : photoIso) / 100)) * 0.6 + (activeLog ? 1 : 0);
  const sceneDR = SCENE_DR[sceneId] ?? 12;
  const brN = bracketId === "off" ? 1 : Number(bracketId[0]);
  const brStep = bracketId === "off" ? 0 : Number(bracketId[2]);
  const brGain = (brN - 1) * brStep;
  const brTimes = Array.from({ length: brN }, (_, i) => formatShutter(effShutter * Math.pow(2, (i - (brN - 1) / 2) * brStep)));
  const pitch = pixelPitch(sensor.width, sensor.height, facts.mp);
  const rule500 = 500 / (focal * crop);
  const npf = (35 * aperture + 30 * pitch) / focal;
  const starScene = sceneId === "night" || sceneId === "blue";
  const flicker = isVideo && scene.palette.indoor && !isFlickerSafe(shutter, mains);
  const ideal = shutter180(vSystem, fps);
  const on180 = Math.abs(Math.log2(shutter / ideal)) < 0.2;

  const exposeCorrectly = () => {
    const baseEV = scene.ev + boost - (cplOn ? CPL_LOSS : 0);
    if (!isVideo) {
      let ev = baseEV - ndStops;
      let tt = correctShutter(ev, aperture, photoIso);
      if (tt < 1 / 8000) {
        const pickP = pickNd(Math.log2(1 / 8000 / tt) + ndStops);
        setNdId(pickP.id);
        ev = baseEV - pickP.stops;
        tt = correctShutter(ev, aperture, photoIso);
      }
      setPhotoShutter(nearestShutter(tt));
      return;
    }
    const over = baseEV - cameraEV(aperture, shutter, minIso);
    const pick = pickNd(over);
    setNdId(pick.id);
    if (!isoAuto) setIso(nearestIso(minIso * Math.pow(2, pick.stops - over), minIso));
  };

  // ── Audio
  const [micId, setMicId] = useState("rode-wpro");
  const [sourceId, setSourceId] = useState<SourceId>("speech");
  const [gain, setGain] = useState(0);
  const [autoLevel, setAutoLevel] = useState(false);
  const [limiter, setLimiter] = useState(true);
  const [lowCut, setLowCut] = useState(false);
  const [float32, setFloat32] = useState(true);
  const [patternId, setPatternId] = useState<PatternId | "">("");
  const [noiseCancel, setNoiseCancel] = useState(false);
  const [safetyOn, setSafetyOn] = useState(true);
  const [onboard, setOnboard] = useState(true);
  const mic = MICS.find((x) => x.id === micId) ?? INTERNAL_MIC;
  const pattern = mic.pat ? (patternId && mic.pat.includes(patternId) ? patternId : mic.pat[0]) : null;
  const f32On = !!mic.float32 && float32;
  const audioBase = {
    mic: effectiveMic(mic, pattern, noiseCancel), source: sourceId, sceneId, outdoor: !scene.palette.indoor,
    cameraDistanceM: focusM, lowCut, float32: f32On,
  };
  const effGain = autoLevel ? autoGain(audioBase) : gain;
  const audio = audioLevels({ ...audioBase, gain: effGain, limiter });
  const quality = audio.snr === null ? null : audio.snr >= 15 ? "good" : audio.snr >= 6 ? "fair" : "poor";
  const tooNoisy = audio.avg - audio.noiseFloor < 18;
  const safetyPeak = !f32On && mic.safety && safetyOn && (audio.clip || audio.overdriven) ? Math.round(audio.rawPeak + mic.safety) : null;
  const dmsBackup = mic.id === "pana-dms1" && safetyOn;
  const ch3 = dmsBackup ? audioLevels({ ...audioBase, mic: effectiveMic(mic, "omni", false), gain: effGain, limiter }) : null;
  const ch4 = dmsBackup ? audioLevels({ ...audioBase, mic: effectiveMic(mic, "omni", false), gain: effGain - 20, limiter }) : null;
  const typeLabel = { lav: t.t_lav, oncam: t.t_oncam, boom: t.t_boom, internal: t.t_internal }[mic.type];

  // ── Group rows: which rows are inside the sharp zone
  const rowsSharp = Array.from({ length: rowCount(subject) }, (_, i) => {
    const dist = (focusM + i * ROW_GAP) * 1000;
    return dist >= dof.near - 1 && dist <= dof.far + 1;
  });

  // ── Custom modes C1–C4 (like a camera's "save to custom mode"), stored in this browser
  type CustomSlot = { name: string; saved: number; data: Record<string, unknown> };
  const SLOTS = ["C1", "C2", "C3", "C4"] as const;
  const [customs, setCustoms] = useState<Record<string, CustomSlot>>(() => {
    try {
      return JSON.parse(localStorage.getItem("video-sim-custom") ?? "{}");
    } catch {
      return {};
    }
  });
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>("C1");
  const [slotName, setSlotName] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const storeCustoms = (next: Record<string, CustomSlot>) => {
    setCustoms(next);
    try {
      localStorage.setItem("video-sim-custom", JSON.stringify(next));
    } catch {
      /* storage unavailable – kept for this visit only */
    }
  };
  const snapshot = () => ({
    shootMode, cameraId, lensId, manualSensor, focal, aperture, focusM,
    vSystem, fps, shutter, isoAuto, iso, wbMode, wbK, profileId, lutId, styleId,
    expMode, photoShutter, photoIso, ndId, vnd, cplOn, cplRot, uvOn,
    peopleMode, coupleN, singleN, subject,
    zebraMode, zebraLevels, falseColor, wfmOn, wfmType, histogram, peaking, frameOn, frameMarkers, frameMask,
    motion, roninId, roninMode, stab, timelineFps, resId, codecId, containerId, flashMode, shutterType, bracketId,
    micId, sourceId, gain, autoLevel, limiter, lowCut, float32, patternId, noiseCancel, safetyOn, onboard,
  });
  const setters = {
    shootMode: setShootMode, cameraId: setCameraId, lensId: setLensId, manualSensor: setManualSensor, focal: setFocal,
    aperture: setAperture, focusM: setFocusM, vSystem: setVSystem, fps: setFps, shutter: setShutter, isoAuto: setIsoAuto,
    iso: setIso, wbMode: setWbMode, wbK: setWbK, profileId: setProfileId, lutId: setLutId, styleId: setStyleId,
    expMode: setExpMode, photoShutter: setPhotoShutter, photoIso: setPhotoIso, ndId: setNdId, vnd: setVnd, cplOn: setCplOn,
    cplRot: setCplRot, uvOn: setUvOn, peopleMode: setPeopleMode, coupleN: setCoupleN,
    singleN: setSingleN, subject: setSubject, zebraMode: setZebraMode, zebraLevels: setZebraLevels, falseColor: setFalseColor,
    wfmOn: setWfmOn, wfmType: setWfmType, histogram: setHistogram, peaking: setPeaking, frameOn: setFrameOn,
    frameMarkers: setFrameMarkers, frameMask: setFrameMask, motion: setMotion, roninId: setRoninId, roninMode: setRoninMode, stab: setStab, containerId: setContainerId,
    timelineFps: setTimelineFps, resId: setResId, codecId: setCodecId, flashMode: setFlashMode, shutterType: setShutterType,
    bracketId: setBracketId, micId: setMicId, sourceId: setSourceId, gain: setGain, autoLevel: setAutoLevel,
    limiter: setLimiter, lowCut: setLowCut, float32: setFloat32, patternId: setPatternId, noiseCancel: setNoiseCancel,
    safetyOn: setSafetyOn, onboard: setOnboard,
  } as unknown as Record<string, (v: unknown) => void>;
  const current = customs[slot];
  const pickSlot = (id: (typeof SLOTS)[number]) => {
    setSlot(id);
    setSlotName(customs[id]?.name ?? "");
    setCustomMsg("");
  };
  const saveCustom = () => {
    const name = slotName.trim() || current?.name || slot;
    storeCustoms({ ...customs, [slot]: { name, saved: Date.now(), data: snapshot() } });
    setSlotName(name);
    setCustomMsg(fill(t.customSaved, slot, name));
  };
  const renameCustom = () => {
    if (!current) return;
    const name = slotName.trim() || slot;
    storeCustoms({ ...customs, [slot]: { ...current, name } });
    setCustomMsg(fill(t.customRenamed, slot, name));
  };
  const loadCustom = () => {
    if (!current) return;
    for (const [k, v] of Object.entries(current.data)) setters[k]?.(v);
    setCustomMsg(fill(t.customLoaded, slot, current.name));
  };
  const clearCustom = () => {
    const next = { ...customs };
    delete next[slot];
    storeCustoms(next);
    setSlotName("");
    setCustomMsg(fill(t.customCleared, slot));
  };

  const sel = (id: string) => ({ id, className: "control" });
  const styleSelect = (id: string) => (
    <>
      <label htmlFor={id}>{t.pictureStyle}</label>
      <select {...sel(id)} value={style.id} onChange={(e) => setStyleId(e.target.value)}>
        {styles.map((x) => (
          <option key={x.id} value={x.id}>{x.name}</option>
        ))}
      </select>
    </>
  );

  const g_cam = (
    <>
{/* Camera & lens */}
          <fieldset className="group">
            <legend>{t.camera}</legend>
            <div className="art-wrap">
              <CameraArt kind={cameraKind(camera?.id)} label={camera ? `${camera.brand} ${camera.model}` : t.manual} />
            </div>
            <label htmlFor="camera">{t.camera}</label>
            <select {...sel("camera")} value={cameraId} onChange={(e) => selectCamera(e.target.value)}>
              <option value="">— {t.manual} —</option>
              {BRANDS.map((b) => (
                <optgroup key={b} label={b}>
                  {CAMERAS.filter((c) => c.brand === b).map((c) => (
                    <option key={c.id} value={c.id}>{b} {c.model}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {camera ? (
              <>
                <label htmlFor="lens">{t.lens}</label>
                <select {...sel("lens")} value={lensId} onChange={(e) => selectLens(e.target.value)}>
                  {!camera.fixedLens && <option value="">— {t.manual} —</option>}
                  {[...new Set(lenses.map((l) => l.maker))].map((m) => (
                    <optgroup key={m} label={m}>
                      {lenses.filter((l) => l.maker === m).map((l) => (
                        <option key={l.id} value={l.id}>{m} {l.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label htmlFor="sensor">{t.sensor}</label>
                <select {...sel("sensor")} value={manualSensor} onChange={(e) => setManualSensor(e.target.value)}>
                  {SENSOR_KEYS.map((k) => (
                    <option key={k} value={k}>{(t.sensors as Record<string, string>)[k] ?? k}</option>
                  ))}
                </select>
              </>
            )}
            {camera && (
            <p className="chip-row">
              <span className="chip">{(t.sensors as Record<string, string>)[sensorKey] ?? sensorKey}</span>
              {lens && (
                <span className="chip">
                  {isPrime ? `${lens.minFocal} mm` : `${lens.minFocal}–${lens.maxFocal} mm`} ·{" "}
                  {lens.apertureWide === lens.apertureTele ? `f/${lens.apertureWide}` : `f/${lens.apertureWide}–${lens.apertureTele}`}
                </span>
              )}
            </p>
            )}
          </fieldset>
    </>
  );
  const g_optics = (
    <>
{/* Optics */}
          <fieldset className="group">
            <legend>{t.optics}</legend>
            <div className="row-label">
              <label htmlFor="focus">{t.distance}</label>
              <output htmlFor="focus">{formatMeters(focusM * 1000)}</output>
            </div>
            <input id="focus" type="range" min={0} max={1000} value={toSlider(focusM)} onChange={(e) => setFocusM(fromSlider(Number(e.target.value)))} />

            <div className="art-wrap art-wrap-lens">
              <LensArt focal={focal} minF={lens ? lens.minFocal : Math.round(focal)} maxF={lens ? lens.maxFocal : Math.round(focal)} maxAperture={apMin} />
            </div>
            <div className="row-label">
              <label htmlFor="focal">{t.focalLength}</label>
              <output htmlFor="focal">{Math.round(focal * 10) / 10} mm</output>
            </div>
            <input
              id="focal"
              type="range"
              min={fMin}
              max={isPrime ? fMin + 1 : fMax}
              step={1}
              value={focal}
              disabled={isPrime}
              onChange={(e) => changeFocal(Number(e.target.value))}
            />
            {Math.abs(crop - 1) > 0.05 && <p className="note">{fill(t.fullFrameEq, eqFocal)}</p>}

            <div className="row-label">
              <label htmlFor="aperture">{t.aperture}</label>
              <output htmlFor="aperture">f/{aperture}</output>
            </div>
            <div className="iris-row">
            <IrisArt aperture={aperture} />
            <input
              id="aperture"
              type="range"
              min={0}
              max={stops.length - 1}
              step={1}
              value={stopIndex}
              disabled={!!lens?.fixedAperture}
              onChange={(e) => setAperture(stops[Number(e.target.value)])}
            />
            </div>
            {aperture > diffractionAt && <p className="warn">{fill(t.diffraction, diffractionAt.toFixed(1))}</p>}

            <label htmlFor="subject">{t.subject}</label>
            <select {...sel("subject")} value={subject} onChange={(e) => setSubject(e.target.value as SubjectKind)}>
              {(["person", "couple", "group1", "group2", "group3"] as const).map((k) => (
                <option key={k} value={k}>{t.subjects[k]}</option>
              ))}
            </select>
          </fieldset>
    </>
  );
  const g_light = (
    <>
{/* Light */}
          <fieldset className="group">
            <legend>{t.light}</legend>
            <label htmlFor="scene">{t.lightScene}</label>
            <select {...sel("scene")} value={sceneId} onChange={(e) => selectScene(e.target.value)}>
              {SCENES.map((s) => (
                <option key={s.id} value={s.id}>{(t.scenes as Record<string, string>)[s.id]}</option>
              ))}
            </select>
            <div className="row-label">
              <label htmlFor="boost">{t.lightIntensity}</label>
              <output htmlFor="boost">{boost > 0 ? "+" : ""}{boost.toFixed(1)} EV</output>
            </div>
            <input id="boost" type="range" min={-4} max={4} step={0.1} value={boost} onChange={(e) => setBoost(Number(e.target.value))} />
            <div className="row-label">
              <label htmlFor="lightK">{t.lightColor}</label>
              <output htmlFor="lightK">{lightK} K</output>
            </div>
            <input id="lightK" className="kelvin" type="range" min={2000} max={10000} step={100} value={lightK} onChange={(e) => setLightK(Number(e.target.value))} />
            <details className="sunplan">
              <summary>{t.sunPlan}</summary>
              <div className="grid2">
                <div>
                  <label htmlFor="place">{t.place}</label>
                  <select {...sel("place")} value={placeId} onChange={(e) => (e.target.value === "geo" ? locate() : setPlaceId(e.target.value))}>
                    {PLACES.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                    <option value="geo">{t.myLocation}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="sundate">{t.date}</label>
                  <input id="sundate" className="control" type="date" value={sunDate} onChange={(e) => e.target.value && setSunDate(e.target.value)} />
                </div>
              </div>
              {geoFail && <p className="warn">{t.geoFail}</p>}
              {!sun.sunrise && !sun.sunset ? (
                <p className="note">{t.noSun}</p>
              ) : (
                <dl className="suntimes">
                  <dt>{t.blueAm}</dt><dd>{span(sun.blueAm)}</dd>
                  <dt>{t.goldenAm}</dt><dd>{span(sun.goldenAm)}</dd>
                  <dt>{t.sunrise}</dt><dd>{hm(sun.sunrise)}</dd>
                  <dt>{t.sunset}</dt><dd>{hm(sun.sunset)}</dd>
                  <dt>{t.goldenPm}</dt><dd>{span(sun.goldenPm)}</dd>
                  <dt>{t.bluePm}</dt><dd>{span(sun.bluePm)}</dd>
                </dl>
              )}
              <div className="sun-btns">
                <button type="button" className="btn-ghost" onClick={() => selectScene("golden")}>{t.toGolden}</button>
                <button type="button" className="btn-ghost" onClick={() => selectScene("blue")}>{t.toBlue}</button>
              </div>
            </details>
          </fieldset>
    </>
  );
  const g_photo = (
    <>
{/* Photo */}
          {!isVideo && (
          <fieldset className="group">
            <legend>{t.photo}</legend>
            <div className="seg" role="radiogroup" aria-label={t.mode}>
              {(["M", "A"] as const).map((m) => (
                <label key={m} className={`seg-item ${expMode === m ? "is-on" : ""}`}>
                  <input type="radio" name="expmode" id={`exp-${m}`} checked={expMode === m} onChange={() => setExpMode(m)} />
                  {m === "M" ? t.modeM : t.modeA}
                </label>
              ))}
            </div>
            <div className="grid2">
              <div>
                <label htmlFor="pshutter">{t.shutter}</label>
                {expMode === "M" ? (
                  <select {...sel("pshutter")} value={String(photoShutter)} onChange={(e) => setPhotoShutter(Number(e.target.value))}>
                    {SHUTTER_SPEEDS.map((v) => (
                      <option key={v} value={String(v)}>{formatShutter(v)}</option>
                    ))}
                  </select>
                ) : (
                  <output id="pshutter" className="readout">{formatShutter(effShutter)}</output>
                )}
              </div>
              <div>
                <label htmlFor="piso">ISO</label>
                <select {...sel("piso")} value={String(photoIso)} onChange={(e) => setPhotoIso(Number(e.target.value))}>
                  {ISOS.map((v) => (
                    <option key={v} value={String(v)}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="pwb">{t.wb}</label>
            <select {...sel("pwb")} value={wbMode} onChange={(e) => setWbMode(e.target.value as WbMode)}>
              {WB_MODES.map((m) => (
                <option key={m} value={m}>{(t.wbModes as Record<string, string>)[m]}</option>
              ))}
            </select>
            {styleSelect("pstyle")}
            {wbMode === "kelvin" && (
              <>
                <div className="row-label">
                  <label htmlFor="pwbK">Kelvin</label>
                  <output htmlFor="pwbK">{wbK} K</output>
                </div>
                <input id="pwbK" className="kelvin" type="range" min={2500} max={10000} step={100} value={wbK} onChange={(e) => setWbK(Number(e.target.value))} />
              </>
            )}
            {shakeRisk && <p className="warn">{fill(t.shake, shakeLimit)}</p>}
          </fieldset>
          )}
    </>
  );

  const zebraValue = (v: number) =>
    zSpec.scale === 255 ? String(v) : v > 100 && zSpec.brand === "sony" ? "100+" : `${v} %`;
  const zebraLevelSelect = (slot: "z1" | "z2") => {
    const spec = slot === "z1" ? zSpec.z1 : zSpec.z2!;
    return (
      <div>
        <label htmlFor={`zebra-${slot}`}>{t.zebraNames[zSpec.brand][slot]}</label>
        <select {...sel(`zebra-${slot}`)} value={String(zl[slot])} onChange={(e) => setZl({ [slot]: Number(e.target.value) })}>
          {spec.levels.map((v) => (
            <option key={v} value={String(v)}>{zebraValue(v)}</option>
          ))}
        </select>
      </div>
    );
  };
  const g_custom = (
    <>
{/* Custom modes */}
          <fieldset className="group">
            <legend>{t.customMode}</legend>
            <div className="grid2">
              <div>
                <label htmlFor="slot">{t.customSlot}</label>
                <select {...sel("slot")} value={slot} onChange={(e) => pickSlot(e.target.value as (typeof SLOTS)[number])}>
                  {SLOTS.map((id) => (
                    <option key={id} value={id}>{customs[id] ? `${id} – ${customs[id].name}` : `${id} – ${t.customEmpty}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="slotname">{t.customName}</label>
                <input id="slotname" className="control" type="text" maxLength={24} value={slotName} placeholder={current?.name ?? slot} onChange={(e) => setSlotName(e.target.value)} />
              </div>
            </div>
            <div className="custom-row">
              <button type="button" className="btn-ghost" onClick={saveCustom}>{t.customSave}</button>
              <button type="button" className="btn-ghost" disabled={!current} onClick={loadCustom}>{t.customLoad}</button>
              <button type="button" className="btn-ghost" disabled={!current} onClick={renameCustom}>{t.customRename}</button>
              <button type="button" className="btn-ghost" disabled={!current} onClick={clearCustom}>{t.customClear}</button>
            </div>
            {customMsg ? (
              <p className="ok">{customMsg}</p>
            ) : current ? (
              <p className="note">{fill(t.customInfo, new Date(current.saved).toLocaleString(lang))}</p>
            ) : (
              <p className="note">{t.customTip}</p>
            )}
          </fieldset>
    </>
  );
  const g_assist = (
    <>
{/* Monitor assists */}
          <fieldset className="group">
            <legend>{t.assist}</legend>
            <label htmlFor="zebra">{t.zebra}</label>
            <select {...sel("zebra")} value={zMode} onChange={(e) => setZebraMode(e.target.value as ZebraMode)}>
              <option value="off">{t.zebraOff}</option>
              <option value="z1">{t.zebraNames[zSpec.brand].z1}</option>
              {zSpec.z2 && <option value="z2">{t.zebraNames[zSpec.brand].z2}</option>}
              {zSpec.both && <option value="z12">{t.zebraNames[zSpec.brand].z1} + {t.zebraNames[zSpec.brand].z2}</option>}
            </select>
            {zMode !== "off" && (
              <div className="grid2">
                {(zMode === "z1" || zMode === "z12") && zebraLevelSelect("z1")}
                {(zMode === "z2" || zMode === "z12") && zSpec.z2 && zebraLevelSelect("z2")}
                {zMode === "z2" && zSpec.z2?.widths && zSpec.z2.widths.length > 1 && (
                  <div>
                    <label htmlFor="zebra-w">{t.zebraRange}</label>
                    <select {...sel("zebra-w")} value={String(zl.w)} onChange={(e) => setZl({ w: Number(e.target.value) })}>
                      {zSpec.z2.widths.map((v) => (
                        <option key={v} value={String(v)}>±{v}{zSpec.scale === 100 ? " %" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            {zMode !== "off" && <p className="note">{t.zebraTips[zSpec.brand]}</p>}

            <div className="checks">
              <label className="check">
                <input type="checkbox" id="wfm" checked={wfmOn} onChange={(e) => setWfmOn(e.target.checked)} />
                WFM
              </label>
              <label className="check">
                <input type="checkbox" id="histogram" checked={histogram} onChange={(e) => setHistogram(e.target.checked)} />
                {t.histogram}
              </label>
              <label className="check">
                <input type="checkbox" id="falsecolor" checked={falseColor} onChange={(e) => setFalseColor(e.target.checked)} />
                {t.falseColor}
              </label>
              <label className="check">
                <input type="checkbox" id="peaking" checked={peaking} onChange={(e) => setPeaking(e.target.checked)} />
                {t.peaking}
              </label>
            </div>
            {wfmOn && (
              <div className="seg" role="radiogroup" aria-label="WFM">
                {(["wave", "vector"] as const).map((k) => (
                  <label key={k} className={`seg-item ${wfmType === k ? "is-on" : ""}`}>
                    <input type="radio" name="wfmtype" id={`wfm-${k}`} checked={wfmType === k} onChange={() => setWfmType(k)} />
                    {k === "wave" ? "WAVE" : "VECTOR"}
                  </label>
                ))}
              </div>
            )}
            {wfmOn && <p className="note">{wfmType === "wave" ? t.wfmWaveTip : t.wfmVectorTip}</p>}
            {falseColor && <p className="note">{t.fcLegend}</p>}
            {peaking && <p className="note">{t.peakingTip}</p>}

            <label className="check">
              <input type="checkbox" id="frameon" checked={frameOn} onChange={(e) => setFrameOn(e.target.checked)} />
              {t.frameMarker}
            </label>
            {frameOn && (
              <>
                {frameMarkers.slice(0, markerCount).map((m, i) => (
                  <div key={i} className="marker-row">
                    <label className="check">
                      <input type="checkbox" id={`marker${i}`} checked={m.on} onChange={(e) => setMarker(i, { on: e.target.checked })} />
                      {markerCount > 1 ? fill(t.markerN, i + 1) : t.frameAspect}
                    </label>
                    <select {...sel(`markerratio${i}`)} aria-label={t.frameAspect} value={m.ratio} disabled={!m.on} onChange={(e) => setMarker(i, { ratio: e.target.value as FrameRatioId })}>
                      {FRAME_RATIOS.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                    <select {...sel(`markercolor${i}`)} aria-label={t.frameColor} value={m.color} disabled={!m.on} onChange={(e) => setMarker(i, { color: e.target.value as FrameColor })}>
                      {(Object.keys(FRAME_COLORS) as FrameColor[]).map((c) => (
                        <option key={c} value={c}>{t.colors[c]}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="marker-row">
                  <label htmlFor="framemask">{t.frameMask}</label>
                  <select {...sel("framemask")} value={String(frameMask)} onChange={(e) => setFrameMask(Number(e.target.value))}>
                    {[0, 25, 50, 75, 100].map((v) => (
                      <option key={v} value={String(v)}>{v} %</option>
                    ))}
                  </select>
                </div>
                <p className="note">{markerCount > 1 ? fill(t.markerTipMulti, markerCount) : t.markerTipOne}</p>
              </>
            )}
          </fieldset>
    </>
  );
  const g_rec = (
    <>
{/* Recording & movement */}
          {isVideo && (
          <fieldset className="group">
            <legend>{t.rec}</legend>
            <div className="grid2">
              <div>
                <label htmlFor="motion">{t.motion}</label>
                <select {...sel("motion")} value={motion} onChange={(e) => setMotion(e.target.value as typeof motion)}>
                  {(["static", "slow", "fast", "walk", "ronin", "car"] as const).map((k) => (
                    <option key={k} value={k}>{t.motions[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="stab">{t.stab}</label>
                <select {...sel("stab")} value={stab} onChange={(e) => setStab(e.target.value as typeof stab)}>
                  {(["off", "ibis", "eis", "boost"] as const).map((k) => (
                    <option key={k} value={k}>{t.stabs[k]}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="chip-row">
              <span className="chip">{facts.readout === 0 ? t.globalShutter : fill(t.readout, facts.readout)}</span>
            </p>
            {stabCrop > 1 && <p className="note">{fill(t.stabCrop, stabCrop, Math.round(focal * crop * stabCrop))}</p>}
            {motion === "ronin" && (
              <>
                <div className="grid2">
                  <div>
                    <label htmlFor="ronin">{t.roninModel}</label>
                    <select {...sel("ronin")} value={roninId} onChange={(e) => setRoninId(e.target.value as RoninId)}>
                      {RONINS.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="roninmode">{t.roninMode}</label>
                    <select {...sel("roninmode")} value={roninMode} onChange={(e) => setRoninMode(e.target.value as RoninMode)}>
                      {(Object.keys(RONIN_MODES) as RoninMode[]).map((m) => (
                        <option key={m} value={m}>{t.roninModes[m]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="chip-row"><span className="chip">{fill(t.roninPayload, ronin.payload)}</span></p>
                <p className="note">{t.roninTip}</p>
                {stab !== "off" && stab !== "ibis" && <p className="warn">{t.roninEis}</p>}
              </>
            )}
            {motion === "walk" && stab === "off" ? (
              <p className="warn">{t.shakeWalk}</p>
            ) : leanDeg >= 1.5 ? (
              <p className="warn">{fill(t.jello, leanDeg.toFixed(1))}</p>
            ) : panSpeed > 0 ? (
              <p className="ok">{t.jelloOk}</p>
            ) : null}

            <div className="grid2">
              <div>
                <label htmlFor="timeline">{t.timeline}</label>
                <select {...sel("timeline")} value={String(timelineFps)} onChange={(e) => setTimelineFps(Number(e.target.value))}>
                  {TIMELINE_RATES.map((f) => (
                    <option key={f} value={String(f)}>{rateLabel(f)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="resolution">{t.resolution}</label>
                <select {...sel("resolution")} value={res.id} onChange={(e) => setResId(e.target.value as ResolutionId)}>
                  {resolutions.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {tlRatio >= 1.5 ? (
              <p className="ok">{fill(t.slowmo, Math.round((1 / tlRatio) * 100), Math.round(tlRatio * 10) / 10)}</p>
            ) : Math.abs(tlRatio - 1) < 0.002 ? (
              <p className="ok">{t.tlMatch}</p>
            ) : tlRatio < 0.8 ? (
              <p className="warn">{fill(t.tlLower, rateLabel(camRate), rateLabel(timelineFps))}</p>
            ) : (
              <p className="warn">{fill(t.tlConform, rateLabel(camRate), rateLabel(timelineFps))}</p>
            )}
            {fps > facts.maxFps && <p className="warn">{fill(t.fpsLimit, fps, facts.maxFps)}</p>}
            {dualIso && (
              <>
                <p className="chip-row"><span className="chip">{fill(t.dualIso, dualIso.slice(0, -1).join(" / "), dualIso[dualIso.length - 1])}</span></p>
                {onSecondBase ? (
                  <p className="ok">{fill(t.dualIsoHigh, activeBase)}</p>
                ) : effIso >= dualIso[1] / 2.5 ? (
                  <p className="note">{fill(t.dualIsoTip, dualIso[0], dualIso[1])}</p>
                ) : null}
              </>
            )}

            <div className="grid2">
              <div>
                <label htmlFor="container">{t.fileFormat}</label>
                <select {...sel("container")} value={container.id} onChange={(e) => setContainerId(e.target.value)}>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="codec">{t.codec}</label>
                <select {...sel("codec")} value={codec} onChange={(e) => setCodecId(e.target.value as CodecId)}>
                  {CODECS.filter((c) => container.codecs.includes(c.id)).map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {container.id === "mp4lite" && <p className="note">{t.mp4LiteTip}</p>}
            <p className="levels">{fill(t.dataRate, mbps, ((mbps * 60) / 8 / 1000).toFixed(1))}</p>
            <p className="note">
              {t.recTime}: {[128, 256, 512, 1000].map((gb) => `${gb === 1000 ? "1 TB" : `${gb} GB`} ≈ ${formatMinutes(minutesOn(gb, mbps))}`).join(" · ")}
            </p>
            <p className="eyebrow">{t.cardSlots}</p>
            <ul className="slots">
              {[...new Set(slotsFor(camera))].map((m) => {
                const cls = mediaClass(m, mbps);
                const n = slotsFor(camera).filter((x) => x === m).length;
                return (
                  <li key={m} className={cls ? "ok" : "warn"}>
                    {n > 1 ? `${n}× ` : ""}{MEDIA[m].label}: {cls ? `✓ ${fill(t.cardNeeds, cls)}` : `✗ ${t.cardTooSlow}`}
                  </li>
                );
              })}
            </ul>
            {res.id === "og" && <p className="note">{t.ogTip}</p>}
          </fieldset>
          )}
    </>
  );
  const g_tech = (
    <>
{/* Flash, shutter, dynamic range (photo) */}
          {!isVideo && (
          <fieldset className="group">
            <legend>{t.flashTech}</legend>
            <div className="grid2">
              <div>
                <label htmlFor="flash">{t.flash}</label>
                <select {...sel("flash")} value={syncLimit ? flashMode : "off"} disabled={!syncLimit} onChange={(e) => setFlashMode(e.target.value as typeof flashMode)}>
                  {(["off", "ttl", "hss"] as const).map((k) => (
                    <option key={k} value={k}>{t.flashModes[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="shuttertype">{t.shutterType}</label>
                <select {...sel("shuttertype")} value={shutterType} onChange={(e) => setShutterType(e.target.value as typeof shutterType)}>
                  {(["mech", "efc", "e"] as const).map((k) => (
                    <option key={k} value={k}>{t.shutterTypes[k]}</option>
                  ))}
                </select>
              </div>
            </div>
            {!syncLimit && <p className="note">{t.noFlash}</p>}
            {syncLimit && flashMode !== "off" && (
              <>
                {syncBad ? (
                  <p className="warn warn-strong">{fill(t.syncWarn, formatShutter(effShutter), formatShutter(syncLimit))}</p>
                ) : flashMode === "ttl" ? (
                  <p className="ok">{fill(t.syncOk, formatShutter(syncLimit))}</p>
                ) : (
                  <p className="note">{t.hssNote}</p>
                )}
                <p className="note">{t.fillTip}</p>
                {shutterType === "e" && <p className="warn">{t.flashESh}</p>}
              </>
            )}
            {shutterType === "e" &&
              (facts.readout === 0 ? (
                <p className="ok">{t.eGlobal}</p>
              ) : banding ? (
                <p className="warn">{fill(t.banding, bands, 2 * mains)}</p>
              ) : (
                <p className="note">{fill(t.eRolling, facts.readout)}</p>
              ))}

            <p className="levels">{fill(t.dr, sceneDR, camDR.toFixed(1))}</p>
            {sceneDR <= camDR + brGain ? (
              <p className="ok">{brGain > 0 ? fill(t.bracketGain, brGain) : t.drOk}</p>
            ) : (
              <p className="warn">{fill(t.drOver, (sceneDR - camDR - brGain).toFixed(1))}</p>
            )}
            <label htmlFor="bracket">{t.bracket}</label>
            <select {...sel("bracket")} value={bracketId} onChange={(e) => setBracketId(e.target.value as typeof bracketId)}>
              {(["off", "3x1", "5x1", "3x2", "5x2"] as const).map((k) => (
                <option key={k} value={k}>{t.brackets[k]}</option>
              ))}
            </select>
            {brN > 1 && <p className="note">{fill(t.bracketTimes, brTimes.join(" · "))}</p>}

            {(starScene || effShutter >= 1) && (
              <>
                <p className="note">{fill(t.stars, formatShutter(rule500), formatShutter(npf))}</p>
                {effShutter > npf && effShutter >= 1 && starScene && <p className="warn">{fill(t.starsWarn, formatShutter(effShutter))}</p>}
              </>
            )}
            {effShutter >= 0.5 && <p className="note">{fill(t.longExp, formatShutter(effShutter))}</p>}
            {ndStops > 0 && (
              <p className="note">
                {fill(
                  t.ndCalc,
                  formatShutter(correctShutter(scene.ev + boost - (cplOn ? CPL_LOSS : 0), aperture, photoIso)),
                  formatShutter(correctShutter(sceneEV, aperture, photoIso))
                )}
              </p>
            )}
          </fieldset>
          )}
    </>
  );
  const g_video = (
    <>
{/* Video */}
          {isVideo && (
          <fieldset className="group">
            <legend>{t.video}</legend>
            <div className="grid2">
              <div>
                <label htmlFor="system">{t.videoSystem}</label>
                <select {...sel("system")} value={vSystem} onChange={(e) => {
                  const s = e.target.value as VideoSystem;
                  changeVideo(s, DEFAULT_FPS[s]);
                }}>
                  <option value="PAL">PAL (50 Hz)</option>
                  <option value="NTSC">NTSC (60 Hz)</option>
                </select>
              </div>
              <div>
                <label htmlFor="fps">{t.frameRate}</label>
                <select {...sel("fps")} value={String(fps)} onChange={(e) => changeVideo(vSystem, Number(e.target.value))}>
                  {VIDEO_SYSTEMS[vSystem].fps.map((f) => (
                    <option key={f} value={String(f)}>{f === 24 && vSystem === "NTSC" ? "24p (23.98)" : `${f}p`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="shutter">{t.shutter}</label>
                <select {...sel("shutter")} value={String(shutter)} onChange={(e) => setShutter(Number(e.target.value))}>
                  {videoShutters(vSystem, fps).map((s) => (
                    <option key={s} value={String(s)}>{formatShutter(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="iso">ISO</label>
                <select {...sel("iso")} value={isoAuto ? "auto" : String(Math.max(iso, minIso))} onChange={(e) => {
                  if (e.target.value === "auto") setIsoAuto(true);
                  else {
                    setIsoAuto(false);
                    setIso(Number(e.target.value));
                  }
                }}>
                  <option value="auto">{t.isoAuto}</option>
                  {isoChoices.map((v) => (
                    <option key={v} value={String(v)}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className={on180 ? "ok" : "note"}>{on180 ? "✓ " : ""}{fill(t.rule180, Math.round(1 / ideal))}</p>

            <label htmlFor="profile">{t.profile}</label>
            <select {...sel("profile")} value={logProfile ? profileId : "standard"} onChange={(e) => setProfileId(e.target.value)}>
              <option value="standard">{t.standard}</option>
              {logs.map((x) => (
                <option key={x.id} value={x.id}>{x.name === "Log" && !camera ? t.logGeneric : x.name}</option>
              ))}
            </select>
            {logProfile ? (
              <>
                <label htmlFor="lut">{t.lutMonitor}</label>
                <select {...sel("lut")} value={lutValue} onChange={(e) => setLutId(e.target.value)}>
                  <option value="none">{t.lutNone}</option>
                  <optgroup label={t.lutMaker}>
                    {makerLuts.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label={t.lutCreative}>
                    {CREATIVE_LUTS.map((x) => (
                      <option key={x.id} value={x.id}>{t[x.id]}</option>
                    ))}
                  </optgroup>
                </select>
                {lutNone && <p className="note">{t.lutNoneTip}</p>}
                <p className="note">{fill(t.logTip, minIso)}</p>
              </>
            ) : (
              styleSelect("vstyle")
            )}

            <label htmlFor="wb">{t.wb}</label>
            <select {...sel("wb")} value={wbMode} onChange={(e) => setWbMode(e.target.value as WbMode)}>
              {WB_MODES.map((m) => (
                <option key={m} value={m}>{(t.wbModes as Record<string, string>)[m]}</option>
              ))}
            </select>
            {wbMode === "kelvin" && (
              <>
                <div className="row-label">
                  <label htmlFor="wbK">Kelvin</label>
                  <output htmlFor="wbK">{wbK} K</output>
                </div>
                <input id="wbK" className="kelvin kelvin-wb" type="range" min={2500} max={10000} step={100} value={wbK} onChange={(e) => setWbK(Number(e.target.value))} />
              </>
            )}

            {flicker && <p className="warn">{fill(t.flicker, vSystem === "PAL" ? "1/50, 1/100" : "1/60, 1/120", mains)}</p>}
            {isoAuto && auto.atLimit && <p className="warn warn-strong">{fill(t.isoLimit, auto.display)}</p>}
          </fieldset>
          )}
    </>
  );
  const g_audio = (
    <>
{/* Audio */}
          {isVideo && (
          <fieldset className="group">
            <legend>{t.audio}</legend>
            <label htmlFor="mic">{t.mic}</label>
            <select {...sel("mic")} value={micId} onChange={(e) => setMicId(e.target.value)}>
              <optgroup label={`★ ${t.myMics}`}>
                {MICS.filter((x) => x.mine).map((x) => (
                  <option key={x.id} value={x.id}>{x.brand} {x.name}</option>
                ))}
              </optgroup>
              <option value="internal">{t.builtIn}{camera ? ` – ${camera.brand} ${camera.model}` : ""}</option>
              {MIC_BRANDS.map((b) => (
                <optgroup key={b} label={b}>
                  {MICS.filter((x) => x.brand === b && !x.mine).map((x) => (
                    <option key={x.id} value={x.id}>{x.brand} {x.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="chip-row">
              <span className="chip">{typeLabel}</span>
              <span className="chip">{fill(t.micDistance, formatMeters(audio.distanceM * 1000))}</span>
            </p>
            {mic.pat && (
              <>
                <label htmlFor="micpat">{t.pattern}</label>
                <select {...sel("micpat")} value={pattern ?? ""} onChange={(e) => setPatternId(e.target.value as PatternId)}>
                  {mic.pat.map((x) => (
                    <option key={x} value={x}>{t.pat[x]}</option>
                  ))}
                </select>
                {pattern === "rear" && <p className="note">{t.rearTip}</p>}
              </>
            )}
            {(mic.float32 || mic.nc || mic.safety || mic.onboard) && (
              <div className="checks">
                {mic.float32 && (
                  <label className="check">
                    <input type="checkbox" id="f32" checked={float32} onChange={(e) => setFloat32(e.target.checked)} />
                    {t.f32}
                  </label>
                )}
                {mic.nc && (
                  <label className="check">
                    <input type="checkbox" id="micnc" checked={noiseCancel} onChange={(e) => setNoiseCancel(e.target.checked)} />
                    {t[mic.nc]}
                  </label>
                )}
                {mic.safety && (
                  <label className="check">
                    <input type="checkbox" id="safety" checked={safetyOn} onChange={(e) => setSafetyOn(e.target.checked)} />
                    {mic.f32cam ? t.dmsBackup : fill(t.safety, mic.safety)}
                  </label>
                )}
                {mic.onboard && (
                  <label className="check">
                    <input type="checkbox" id="onboard" checked={onboard} onChange={(e) => setOnboard(e.target.checked)} />
                    {t.onboard}
                  </label>
                )}
              </div>
            )}
            {mic.float32 && <p className={f32On ? "ok" : "note"}>{f32On ? (mic.f32cam ? t.f32cam : t.float32) : t.f32off}</p>}
            {mic.onboard && onboard && <p className="note">{t.onboardOn}</p>}

            <label htmlFor="source">{t.source}</label>
            <select {...sel("source")} value={sourceId} onChange={(e) => setSourceId(e.target.value as SourceId)}>
              {(Object.keys(SOURCES) as SourceId[]).map((k) => (
                <option key={k} value={k}>{t[`src_${k}` as const]}</option>
              ))}
            </select>

            <div className="row-label">
              <label htmlFor="gain">{t.gain}</label>
              <output htmlFor="gain">{effGain > 0 ? "+" : ""}{effGain} dB</output>
            </div>
            <input id="gain" type="range" min={-12} max={30} step={1} value={effGain} disabled={autoLevel} onChange={(e) => setGain(Number(e.target.value))} />
            <div className="checks">
              <label className="check">
                <input type="checkbox" id="autolevel" checked={autoLevel} onChange={(e) => setAutoLevel(e.target.checked)} />
                {t.autoLevel}
              </label>
              <label className="check">
                <input type="checkbox" id="limiter" checked={limiter} onChange={(e) => setLimiter(e.target.checked)} />
                {t.limiter}
              </label>
              <label className="check">
                <input type="checkbox" id="lowcut" checked={lowCut} onChange={(e) => setLowCut(e.target.checked)} />
                {t.lowCut}
              </label>
            </div>

            <p className="levels">{fill(t.levelLine, Math.round(audio.avg), Math.round(audio.peak))}</p>
            {ch3 && ch4 && (
              <div className="channels">
                <p className="eyebrow">{t.channels}</p>
                {([[t.ch12, audio], [t.ch3, ch3], [t.ch4, ch4]] as const).map(([label, lv]) => (
                  <p key={label} className={lv.clip || lv.overdriven ? "warn" : "levels-sm"}>
                    {fill(t.chLine, label, Math.round(lv.avg))}{lv.clip || lv.overdriven ? ` · ${t.chClip}` : ""}
                  </p>
                ))}
              </div>
            )}
            {quality && (
              <p className={quality === "good" ? "ok" : quality === "fair" ? "note" : "warn"}>
                {t.intelligibility}: {t[`q_${quality}` as const]}
              </p>
            )}
            {audio.f32over ? (
              <p className="note">{t.f32over}</p>
            ) : audio.clip ? (
              <p className="warn warn-strong">{t.clip}</p>
            ) : audio.overdriven ? (
              <p className="warn warn-strong">{t.overdriven}</p>
            ) : audio.avg < -36 ? (
              <p className="warn">{t.tooQuiet}</p>
            ) : tooNoisy ? (
              <p className="warn">{t.noisy}</p>
            ) : (
              <p className="ok">{t.goodLevel}</p>
            )}
            {audio.limiting && !audio.overdriven && <p className="note">{t.limiting}</p>}
            {safetyPeak !== null && (
              <p className={safetyPeak < 0 ? "ok" : "warn"}>{fill(safetyPeak < 0 ? t.safetyOk : t.safetyBad, safetyPeak)}</p>
            )}
          </fieldset>
          )}
    </>
  );
  const g_filters = (
    <>
{/* Filters */}
          <fieldset className="group">
            <legend>{t.filters}</legend>
            <label htmlFor="nd">{t.nd}</label>
            <select {...sel("nd")} value={ndId} onChange={(e) => setNdId(e.target.value)}>
              {ND_FILTERS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id === "none" ? t.none : n.id === "vnd" ? t.ndVariable : `${n.label} (${fill(t.stops, n.stops)})`}
                </option>
              ))}
            </select>
            {ndId === "vnd" && (
              <>
                <div className="row-label">
                  <label htmlFor="vnd">{t.ndVariable}</label>
                  <output htmlFor="vnd">{fill(t.stops, vnd)}</output>
                </div>
                <input id="vnd" type="range" min={1} max={9} step={0.5} value={vnd} onChange={(e) => setVnd(Number(e.target.value))} />
              </>
            )}
            <div className="checks">
              <label className="check">
                <input type="checkbox" id="cpl" checked={cplOn} onChange={(e) => setCplOn(e.target.checked)} />
                {t.cpl}
              </label>
              <label className="check">
                <input type="checkbox" id="uv" checked={uvOn} onChange={(e) => setUvOn(e.target.checked)} />
                {t.uv}
              </label>
            </div>
            {cplOn && (
              <>
                <div className="row-label">
                  <label htmlFor="cplRot">{t.cplRotation}</label>
                  <output htmlFor="cplRot">{cplRot}°</output>
                </div>
                <input id="cplRot" type="range" min={0} max={90} value={cplRot} onChange={(e) => setCplRot(Number(e.target.value))} />
              </>
            )}
            {filterStops > 0 && <p className="note">{fill(t.filterLoss, Math.round(filterStops * 10) / 10)}</p>}
          </fieldset>
    </>
  );
  const g_btn = (
    <>
<button type="button" className="btn-primary" onClick={exposeCorrectly}>
            {t.autoExpose}
          </button>
    </>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div className="brand-text">
            <span className="brand-name">Mustafi Studio</span>
            <h1 className="brand-title">{t.appTitle}</h1>
          </div>
        </div>
        <div className="topbar-tools">
          <label className="sr-only" htmlFor="lang">{t.language}</label>
          <select id="lang" className="control control-compact" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? t.lightMode : t.darkMode}
            title={isDark ? t.lightMode : t.darkMode}
          >
            {isDark ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <p className="tagline">{isVideo ? t.appTag : t.appTagPhoto}</p>

      <div className="modes" role="tablist" aria-label={`${t.photo} / ${t.video}`}>
        {(["photo", "video"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={shootMode === m}
            className={`mode-tab ${shootMode === m ? "is-active" : ""} mode-${m}`}
            onClick={() => setShootMode(m)}
          >
            <span className="mode-dot" aria-hidden="true" />
            {m === "photo" ? `📷 ${t.photo}` : `🎬 ${t.video}`}
          </button>
        ))}
      </div>

      <main
        ref={studioRef}
        className={`studio ${isVideo ? "is-video" : "is-photo"}`}
        style={{ "--side": sideFrac } as CSSProperties}
      >
        {/* wide area: side view, numbers, camera & optics */}
        <div className="studio-main">
            <PhotoDiagram
              focal={focal}
              aperture={aperture}
              focusM={focusM}
              nearMM={dof.near}
              farMM={dof.far}
              hyperfocalMM={dof.hyperfocal}
              sensorHeightMM={isVideo ? frameH : sensor.height}
              subject={subject}
              aspect={narrow ? 1.6 : 2.9}
              label={t.sharpZone}
              nearLabel={t.near}
              farLabel={t.far}
            />
          <dl className="stats">
            <div><dt>{t.near}</dt><dd>{formatMeters(dof.near)}</dd></div>
            <div><dt>{t.far}</dt><dd>{formatMeters(dof.far)}</dd></div>
            <div><dt>{t.total}</dt><dd>{formatMeters(totalMM)}</dd></div>
            <div><dt>{t.hyperfocal}</dt><dd>{formatMeters(dof.hyperfocal)}</dd></div>
          </dl>
          <div className="row-tools">
            {rowsSharp.length > 1 && (
              <span className="chip-row">
                {rowsSharp.map((ok, i) => (
                  <span key={i} className={`chip ${ok ? "chip-ok" : "chip-bad"}`}>
                    {fill(ok ? t.rowOk : t.rowSoft, i + 1)}
                  </span>
                ))}
              </span>
            )}
            <button type="button" className="btn-ghost" disabled={!canHyperfocal} onClick={() => setFocusM(dof.hyperfocal / 1000)}>
              {t.setHyperfocal}
            </button>
          </div>
          <div className="card card-wide">
            {g_cam}
            {g_optics}
          </div>
          {isVideo && <div className="card card-wide card-audio">{g_audio}</div>}
        </div>

        <div
          className="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={20}
          aria-valuemax={65}
          aria-valuenow={Math.round(sideFrac * 100)}
          tabIndex={0}
          title="↔"
          onPointerDown={startDrag}
          onDoubleClick={() => saveSide(1 / 3)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") saveSide(sideFrac + 0.02);
            if (e.key === "ArrowRight") saveSide(sideFrac - 0.02);
          }}
        >
          <span aria-hidden="true" />
        </div>

        {/* narrow column: camera monitor and settings */}
        <aside className="studio-side">
          <p className="eyebrow col-title">{t.monitor}</p>
          <Monitor
            mode={shootMode}
            aspect={isVideo ? 16 / 9 : sensor.width / sensor.height}
            meter={{ avg: audio.avg, peak: audio.peak, clip: audio.clip, limiting: audio.limiting }}
            focal={focal}
            aperture={aperture}
            focusM={focusM}
            frameHeightMM={isVideo ? frameH / stabCrop : sensor.height}
            cocMM={coc}
            subject={subject}
            palette={viewPalette}
            backdrop={backdropKind}
            people={people}
            photo={bd?.photo ? `./${bd.photo}` : undefined}
            exposureDelta={exposureDelta}
            cast={cast}
            grain={grain}
            logView={!!activeLog && lutNone}
            look={look}
            assist={{
              zebras: zebraBands(zSpec, zMode, zl.z1, zl.z2, zWidth),
              falseColor,
              wfm: wfmOn ? wfmType : "off",
              histogram,
              peaking,
              frames: frameOn
                ? activeMarkers.map((m) => ({ ratio: FRAME_RATIOS.find((r) => r.id === m.ratio)!.r, color: FRAME_COLORS[m.color] }))
                : [],
              frameMask: frameMask / 100,
            }}
            skew={leanDeg}
            cpl={cplEffect}
            uv={uvOn}
            label={t.monitor}
            hud={{
              fps: isVideo ? `${fps}p ${vSystem}` : expMode === "A" ? "A" : "M",
              shutter: formatShutter(effShutter),
              iso: useAuto ? `AUTO ${auto.display}` : String(effIso),
              focus: formatMeters(focusM * 1000),
              profile: activeLog ? `${activeLog.name}${lutTag}` : style === styles[0] ? "" : style.name,
              filters: filterTag,
              wb: `${wbMode === "auto" ? "AWB " : ""}${Math.round(camWbK / 100) * 100}K`,
            }}
          />
          <div className="backdrop-row">
            <label htmlFor="backdrop">{t.backdrop}</label>
            <select id="backdrop" className="control" value={backdropId} onChange={(e) => setBackdropId(e.target.value)}>
              <optgroup label={t.bgDrawn}>
                {(["auto", "garden", "curtain", "forest", "city", "beach"] as const).map((k) => (
                  <option key={k} value={k}>{t.backdrops[k]}</option>
                ))}
              </optgroup>
              <optgroup label={t.bgPhotos}>
                {PHOTO_BACKDROPS.map((k) => (
                  <option key={k} value={k}>{t.photoBackdrops[k]}</option>
                ))}
              </optgroup>

            </select>
          </div>
          <div className="backdrop-row people-row">
            <label htmlFor="peoplemode">{t.people}</label>
            <select id="peoplemode" className="control" value={peopleMode} onChange={(e) => setPeopleMode(e.target.value as "photo" | "drawn")}>
              <option value="drawn">{t.peopleDrawn}</option>
              <option value="photo">{t.peoplePhotos}</option>
            </select>
            {peopleMode === "photo" && (
              <>
                {subject === "couple" && (
                  <select id="couplepick" className="control" aria-label={t.couplePick} value={String(couplePhoto?.n ?? "")} onChange={(e) => setCoupleN(Number(e.target.value))}>
                    {COUPLES.map((p) => (
                      <option key={p.n} value={String(p.n)}>#{p.n}{p.cut ? " ✂" : ""}</option>
                    ))}
                  </select>
                )}
                {subject === "person" && (
                  <select id="singlepick" className="control" aria-label={t.personPick} value={String(singlePhoto?.n ?? "")} onChange={(e) => setSingleN(Number(e.target.value))}>
                    {(["bride", "man", "woman"] as const).map((k) => (
                      <optgroup key={k} label={t.personKinds[k]}>
                        {byKind(k).map((p) => (
                          <option key={p.n} value={String(p.n)}>#{p.n}{p.cut ? " ✂" : ""}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
          {peopleMode === "photo" && subject.startsWith("group") && (
            <p className="note people-note">{fill(t.guestPool, GUEST_MEN.length, GUEST_WOMEN.length)}</p>
          )}
          <div className="card">
            {g_custom}
            {g_light}
            {g_photo}
            {g_tech}
            {g_video}
            {g_rec}
            {g_assist}
            {g_filters}
            {g_btn}
          </div>
        </aside>
      </main>

      <footer className="footer">
        <span>© 2026 Mustafi Studio</span>
        <a href="https://github.com/Ado-prog/video-simulator" target="_blank" rel="noreferrer">{t.sourceCode}</a>
      </footer>
    </div>
  );
}
