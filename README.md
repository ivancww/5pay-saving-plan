# AVA Saving — Phase 1

Independent AVA module for the five-year Saving conversation. The app uses the official Saving GAS endpoint as its cloud-default source, caches official data locally for offline revisit, and keeps the current conversation and presentation overrides in the User/Local layer.

Open `index.html` through a static web server. The PDF action uses the browser's native print dialog with an A4-friendly print stylesheet; choose “Save as PDF”.

## Structure

- `src/data.js` — official GAS loading, normalization, cache and local overrides.
- `src/media.js` — provider-independent cloud-media boundary; only references and metadata are accepted.
- `src/portable.js` — versioned Saving User backup/restore package; QR remains a platform pointer.
- `src/calculation.js` — exact-row official multiplier adapter; no interpolation, extrapolation or compound-return fallback.
- `src/state.js` — actual visited-screen history and session state.
- `src/views.js` — P1–P7, Customer View and Front Edit/Preview presentation.
- `src/main.js` — application orchestration and interaction events.
- `styles.css` — AVA Design System-aligned standalone composition and responsive rules.

## Checks

```sh
python3 tests/calculation.test.py
python3 tests/static_checks.py
```

See [`DATA_VALIDATION.md`](DATA_VALIDATION.md) for the captured official endpoint evidence and known limitations.

## User pages and media

User-created content, Image pages (up to 6 references) and Video pages (1 reference) are stored as structured local overrides. Media binaries are never written to LocalStorage or backup JSON. The current independent preview has no connected Cloud Media Provider, so media references render a safe `媒體暫時無法使用` state until AVA Platform supplies an authorized provider. Portable backup preserves page order, visibility, content and media references without copying binary data; QR compatibility is represented as a platform-owned pointer contract rather than a Saving-specific QR implementation.
