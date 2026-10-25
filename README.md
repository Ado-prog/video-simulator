# Photo & Video Simulator · Mustafi Studio

**▶ Try it live (free, no sign-up):** https://ado-prog.github.io/video-simulator/

![Camera monitor preview: wedding couple in a garden with background blur, audio meter and exposure HUD](docs/monitor.jpg)

| Side view: sharp zone | Group in a wedding hall |
|---|---|
| ![Side view with camera, angle of view and sharp zone](docs/side-view.jpg) | ![Group photo on the monitor in a wedding hall](docs/monitor-hall.jpg) |

A depth-of-field, light, exposure and audio simulator for photographers and videographers, made by [Mustafi Studio](https://github.com/Ado-prog) (Zürich & Prizren).

See on a simulated camera monitor how focus distance, focal length, aperture, light, shutter, ISO, filters and Log profiles change the picture, before you are on set.

## Features

- **Photo or video:** switch at the top; each mode shows only its own settings (photo: M/A mode, shutter, ISO, camera-shake warning; video: PAL/NTSC, frame rates, Log, audio)
- **Camera monitor preview (16:9)** with background blur and bokeh, REC/HUD, exposure meter and AF frame
- **Sharp zone** from the camera outwards: near and far limit, total depth of field, hyperfocal distance
- **Cameras & lenses:** Panasonic, Sony, Canon, Nikon (plus Sigma and Tamron lenses), DJI (Osmo, action cams, drones) and Insta360
- **Video settings:** PAL/NTSC, frame rates, 180° shutter rule, Auto ISO, white balance, flicker warning under artificial light
- **Log profiles:** V-Log, S-Log2/3, C-Log2/3, N-Log, D-Log / D-Log M, I-Log, with LUT preview
- **Filters:** ND2–ND64000, variable ND, CPL, UV, plus a one-click "expose correctly" that picks the ND you need
- **Audio (video mode):** microphones (RØDE Wireless PRO, Panasonic DMW-MS2, plus RØDE, DJI, Sennheiser, Deity, Hollyland, Sony, Canon, Nikon and the camera's built-in mic), sound sources, gain, auto level, limiter, low cut, live level meter on the monitor, clipping and noise warnings, speech clarity
- **Group photos in 1, 2 or 3 rows:** each row stands further back, so you can see which rows are still sharp
- **Light scenes:** summer, spring, autumn, winter, overcast, golden hour, blue hour, night, wedding hall, party/disco
- **12 languages:** German, Bosnian, Serbian, Albanian, English, Turkish, Spanish, French, Russian, Japanese, Chinese, Korean

Camera and lens specifications are approximate and meant for planning, not as manufacturer data.

## Run locally

```bash
npm install
npm run dev
```

## License

MIT © 2026 Adis Mustafi (Mustafi Studio)

## Share it

If this helps you on set, a ⭐ on GitHub helps other photographers and videographers find it.

**Keywords:** depth of field calculator, DOF simulator, bokeh preview, exposure simulator, ND filter calculator, 180 degree shutter rule, V-Log, S-Log3, wedding videography, Schärfentiefe-Rechner, Belichtung

