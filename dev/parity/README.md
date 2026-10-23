# iOS 26 parity harness

Compares the `liquidglass` web components against native iOS 26
`.glassEffect(.regular)` rendering in the Simulator.

## Scenes (selected by launch arg, passed via `simctl launch`)

- *(default)* — glass capsules over flat colors / a photo, light + dark side by side
- `-controls` — native segmented picker, glass buttons, search field over `tahoe-{scheme}.webp`
- `-web` — the same card rendered by the library inside a WKWebView
- `-webcontrols` — web controls scene (auto-scrolls to it)

## Build & run

```sh
./build-web.sh                     # esbuild web/app.tsx + copy src/styles.css into GlassRef/Web
cd GlassRef && xcodegen            # generate GlassRef.xcodeproj
xcodebuild -project GlassRef.xcodeproj -scheme GlassRef \
  -destination 'platform=iOS Simulator,id=<sim udid>' -configuration Debug build
xcrun simctl install booted <path-to>/GlassRef.app
xcrun simctl launch booted ca.kelvinzhang.parity.GlassRef -web
xcrun simctl io booted screenshot /tmp/web.png
```

`compare.py` / `compare_v2.py` sample pill centers from a native + web screenshot
of the card scene and print per-row color deltas.
