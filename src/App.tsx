import { useEffect, useMemo, useState } from "react";
import Monitor, { type SubjectKind } from "./Monitor";
import SharpZone from "./SharpZone";
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

  const sceneEV = scene.ev + boost - filterStops;
  const auto = autoIso(sceneEV, aperture, shutter, minIso);
  const effIso = isoAuto ? auto.iso : Math.max(iso, minIso);
  const exposureDelta = sceneEV - cameraEV(aperture, shutter, effIso);
  const camWbK = whiteBalanceKelvin(wbMode, lightK, wbK);
  const cast = colorCast(lightK, camWbK);
  const grain = Math.min(0.45, Math.max(0, Math.log2(effIso / 100)) * 0.045 * Math.sqrt(crop));
  const mains = VIDEO_SYSTEMS[vSystem].mainsHz;
  const flicker = scene.palette.indoor && !isFlickerSafe(shutter, mains);
  const ideal = shutter180(vSystem, fps);
  const on180 = Math.abs(Math.log2(shutter / ideal)) < 0.2;

  const exposeCorrectly = () => {
    const baseEV = scene.ev + boost - (cplOn ? CPL_LOSS : 0);
    const over = baseEV - cameraEV(aperture, shutter, minIso);
    const pick = pickNd(over);
    setNdId(pick.id);
    if (!isoAuto) setIso(nearestIso(minIso * Math.pow(2, pick.stops - over), minIso));
  };

  const sel = (id: string) => ({ id, className: "control" });

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

      <p className="tagline">{t.appTag}</p>

      <main className="layout">
        <section className="stage" aria-label={t.monitor}>
          <Monitor
            focal={focal}
            aperture={aperture}
            focusM={focusM}
            frameHeightMM={frameH}
            cocMM={coc}
            subject={subject}
            palette={scene.palette}
            exposureDelta={exposureDelta}
            cast={cast}
            grain={grain}
            logView={!!logProfile && !lut}
            cpl={cplEffect}
            uv={uvOn}
            label={t.monitor}
            hud={{
              fps: `${fps}p ${vSystem}`,
              shutter: formatShutter(shutter),
              iso: isoAuto ? `AUTO ${auto.display}` : String(Math.max(iso, minIso)),
              focus: formatMeters(focusM * 1000),
              profile: logProfile ? `${logProfile.name}${lut ? " + LUT" : ""}` : "",
              filters: filterTag,
              wb: `${Math.round(camWbK / 100) * 100}K`,
            }}
          />
          <p className="caption">{scene.palette.indoor ? t.monitorCaptionIndoor : t.monitorCaption}</p>

          <dl className="stats">
            <div><dt>{t.near}</dt><dd>{formatMeters(dof.near)}</dd></div>
            <div><dt>{t.far}</dt><dd>{formatMeters(dof.far)}</dd></div>
            <div><dt>{t.total}</dt><dd>{formatMeters(totalMM)}</dd></div>
            <div><dt>{t.hyperfocal}</dt><dd>{formatMeters(dof.hyperfocal)}</dd></div>
          </dl>

          <SharpZone focusM={focusM} nearMM={dof.near} farMM={dof.far} hyperfocalMM={dof.hyperfocal} label={t.sharpZone} />
          <button
            type="button"
            className="btn-ghost"
            disabled={!canHyperfocal}
            onClick={() => setFocusM(dof.hyperfocal / 1000)}
          >
            {t.setHyperfocal}
          </button>
        </section>

        <aside className="panel">
          {/* Camera & lens */}
          <fieldset className="group">
            <legend>{t.camera}</legend>
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

          {/* Optics */}
          <fieldset className="group">
            <legend>{t.optics}</legend>
            <div className="row-label">
              <label htmlFor="focus">{t.distance}</label>
              <output htmlFor="focus">{formatMeters(focusM * 1000)}</output>
            </div>
            <input id="focus" type="range" min={0} max={1000} value={toSlider(focusM)} onChange={(e) => setFocusM(fromSlider(Number(e.target.value)))} />

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
            {aperture > diffractionAt && <p className="warn">{fill(t.diffraction, diffractionAt.toFixed(1))}</p>}

            <label htmlFor="subject">{t.subject}</label>
            <select {...sel("subject")} value={subject} onChange={(e) => setSubject(e.target.value as SubjectKind)}>
              {(["person", "couple", "group"] as const).map((k) => (
                <option key={k} value={k}>{t.subjects[k]}</option>
              ))}
            </select>
          </fieldset>

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

          {/* Video */}
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

          <button type="button" className="btn-primary" onClick={exposeCorrectly}>
            {t.autoExpose}
          </button>
        </aside>
      </main>

      <footer className="footer">
        <span>© 2026 Mustafi Studio</span>
        <a href="https://github.com/Ado-prog/video-simulator" target="_blank" rel="noreferrer">{t.sourceCode}</a>
      </footer>
    </div>
  );
}
