import { useEffect, useMemo, useState } from "react";
import Monitor, { type SubjectKind, ROW_GAP, rowCount } from "./Monitor";
import { MICS, MIC_BRANDS, INTERNAL_MIC, SOURCES, type SourceId, audioLevels, autoGain } from "./audio";
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
  videoShutters,
  shutter180,
  isFlickerSafe,
  autoIso,
  ND_FILTERS,
  CPL_LOSS,
  pickNd,
  nearestIso,
} from "./lighting";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Focus distance slider runs on a log scale from 0.3 m to 30 m.
const D_MIN = 0.3;
const D_MAX = 30;
const toSlider = (m: number) => Math.round((Math.log(m / D_MIN) / Math.log(D_MAX / D_MIN)) * 1000);
const fromSlider = (v: number) => D_MIN * Math.pow(D_MAX / D_MIN, v / 1000);

const DEFAULT_CAMERA = "pana-s1ii";
const DEFAULT_LENS = "L:Sigma:24-70mm F2.8 DG DN II Art";

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

  const [shootMode, setShootMode] = useState<"photo" | "video">("video");
  const isVideo = shootMode === "video";

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

  // ── Optics
  const [focal, setFocal] = useState(50);
  const [aperture, setAperture] = useState(2.8);
  const [focusM, setFocusM] = useState(3);
  const [subject, setSubject] = useState<SubjectKind>("couple");
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
  const [lut, setLut] = useState(true);
  const logs = logProfilesFor(camera);
  const logProfile = logs.find((x) => x.id === profileId);
  const minIso = logProfile?.minIso ?? 100;
  const isoChoices = [...new Set([minIso, ...ISOS.filter((v) => v >= minIso)])];

  const changeVideo = (sys: VideoSystem, rate: number) => {
    setVSystem(sys);
    setFps(rate);
    setShutter(shutter180(sys, rate));
  };

  // photo settings
  const [expMode, setExpMode] = useState<"M" | "A">("M");
  const [photoShutter, setPhotoShutter] = useState(1 / 250);
  const [photoIso, setPhotoIso] = useState(800);

  const sceneEV = scene.ev + boost - filterStops;
  const activeLog = isVideo ? logProfile : undefined;
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
  const grain = Math.min(0.45, Math.max(0, Math.log2(effIso / 100)) * 0.045 * Math.sqrt(crop));
  const mains = VIDEO_SYSTEMS[vSystem].mainsHz;
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
  const mic = MICS.find((x) => x.id === micId) ?? INTERNAL_MIC;
  const audioBase = { mic, source: sourceId, sceneId, outdoor: !scene.palette.indoor, cameraDistanceM: focusM, lowCut };
  const effGain = autoLevel ? autoGain(audioBase) : gain;
  const audio = audioLevels({ ...audioBase, gain: effGain, limiter });
  const quality = audio.snr === null ? null : audio.snr >= 15 ? "good" : audio.snr >= 6 ? "fair" : "poor";
  const tooNoisy = audio.avg - audio.noiseFloor < 18;
  const typeLabel = { lav: t.t_lav, oncam: t.t_oncam, boom: t.t_boom, internal: t.t_internal }[mic.type];

  // ── Group rows: which rows are inside the sharp zone
  const rowsSharp = Array.from({ length: rowCount(subject) }, (_, i) => {
    const dist = (focusM + i * ROW_GAP) * 1000;
    return dist >= dof.near - 1 && dist <= dof.far + 1;
  });

  const sel = (id: string) => ({ id, className: "control" });

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
            <p className="chip-row">
              <span className="chip">{(t.sensors as Record<string, string>)[sensorKey] ?? sensorKey}</span>
              {lens && (
                <span className="chip">
                  {isPrime ? `${lens.minFocal} mm` : `${lens.minFocal}–${lens.maxFocal} mm`} ·{" "}
                  {lens.apertureWide === lens.apertureTele ? `f/${lens.apertureWide}` : `f/${lens.apertureWide}–${lens.apertureTele}`}
                </span>
              )}
            </p>
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
                  changeVideo(s, VIDEO_SYSTEMS[s].fps[0]);
                }}>
                  <option value="PAL">PAL (50 Hz)</option>
                  <option value="NTSC">NTSC (60 Hz)</option>
                </select>
              </div>
              <div>
                <label htmlFor="fps">{t.frameRate}</label>
                <select {...sel("fps")} value={String(fps)} onChange={(e) => changeVideo(vSystem, Number(e.target.value))}>
                  {VIDEO_SYSTEMS[vSystem].fps.map((f) => (
                    <option key={f} value={String(f)}>{f === 24 ? "24p (23.98)" : `${f}p`}</option>
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
            {logProfile && (
              <>
                <label className="check">
                  <input type="checkbox" id="lut" checked={lut} onChange={(e) => setLut(e.target.checked)} />
                  {t.lutPreview}
                </label>
                <p className="note">{fill(t.logTip, minIso)}</p>
              </>
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
            {mic.float32 && <p className="note">{t.float32}</p>}

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
            {quality && (
              <p className={quality === "good" ? "ok" : quality === "fair" ? "note" : "warn"}>
                {t.intelligibility}: {t[`q_${quality}` as const]}
              </p>
            )}
            {audio.clip ? (
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

      <main className="simple">
        {/* left: side view, numbers, camera & optics */}
        <div className="col col-left">
            <PhotoDiagram
              focal={focal}
              aperture={aperture}
              focusM={focusM}
              nearMM={dof.near}
              farMM={dof.far}
              hyperfocalMM={dof.hyperfocal}
              sensorHeightMM={isVideo ? frameH : sensor.height}
              subject={subject}
              aspect={isVideo ? 16 / 9 : sensor.width / sensor.height}
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
          {rowsSharp.length > 1 && (
            <p className="chip-row">
              {rowsSharp.map((ok, i) => (
                <span key={i} className={`chip ${ok ? "chip-ok" : "chip-bad"}`}>
                  {fill(ok ? t.rowOk : t.rowSoft, i + 1)}
                </span>
              ))}
            </p>
          )}
          <div className="card">
            {g_cam}
            {g_optics}
            <button type="button" className="btn-ghost" disabled={!canHyperfocal} onClick={() => setFocusM(dof.hyperfocal / 1000)}>
              {t.setHyperfocal}
            </button>
            {isVideo && g_audio}
          </div>
        </div>

        {/* right: what the camera monitor shows, light and camera settings */}
        <div className="col col-right">
          <p className="eyebrow col-title">{t.monitor}</p>
          <Monitor
            mode={shootMode}
            aspect={isVideo ? 16 / 9 : sensor.width / sensor.height}
            meter={{ avg: audio.avg, peak: audio.peak, clip: audio.clip, limiting: audio.limiting }}
            focal={focal}
            aperture={aperture}
            focusM={focusM}
            frameHeightMM={isVideo ? frameH : sensor.height}
            cocMM={coc}
            subject={subject}
            palette={scene.palette}
            exposureDelta={exposureDelta}
            cast={cast}
            grain={grain}
            logView={!!activeLog && !lut}
            cpl={cplEffect}
            uv={uvOn}
            label={t.monitor}
            hud={{
              fps: isVideo ? `${fps}p ${vSystem}` : expMode === "A" ? "A" : "M",
              shutter: formatShutter(effShutter),
              iso: useAuto ? `AUTO ${auto.display}` : String(effIso),
              focus: formatMeters(focusM * 1000),
              profile: activeLog ? `${activeLog.name}${lut ? " + LUT" : ""}` : "",
              filters: filterTag,
              wb: `${Math.round(camWbK / 100) * 100}K`,
            }}
          />
          <p className="caption">{scene.palette.indoor ? t.monitorCaptionIndoor : t.monitorCaption}</p>
          <div className="card">
            {g_light}
            <div className="mode-switch" role="tablist" aria-label={`${t.photo} / ${t.video}`}>
              {(["photo", "video"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={shootMode === m}
                  className={`mode-btn mode-btn-${m} ${shootMode === m ? "is-active" : ""}`}
                  onClick={() => setShootMode(m)}
                >
                  {m === "photo" ? `📷 ${t.photo}` : `🎬 ${t.video}`}
                </button>
              ))}
            </div>
            {g_photo}
            {g_video}
            {g_filters}
            {g_btn}
          </div>
        </div>
      </main>

      <footer className="footer">
        <span>© 2026 Mustafi Studio</span>
        <a href="https://github.com/Ado-prog/video-simulator" target="_blank" rel="noreferrer">{t.sourceCode}</a>
      </footer>
    </div>
  );
}
