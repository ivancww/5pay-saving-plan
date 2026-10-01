# AVA Saving — Phase 1

Independent AVA module for the five-year Saving conversation. The app uses the official Saving GAS endpoint as its cloud-default source, caches official data locally for offline revisit, and keeps the current conversation and presentation overrides in the User/Local layer.

Open `index.html` through a static web server. The PDF action uses the browser's native print dialog with an A4-friendly print stylesheet; choose “Save as PDF”.

## Structure

- `src/data.js` — official GAS loading, normalization, cache and local overrides.
- `src/media.js` — provider-independent cloud-media boundary; only references and metadata are accepted.
- `src/portable.js` — versioned Saving User backup/restore package; QR remains a platform pointer.
- `src/calculation.js` — exact-row official multiplier adapter; no interpolation, extrapolation or compound-return fallback.
- `src/state.js` — actual visited-screen history and session state.
- `src/views.js` — customer scenario visuals, P1–P7, Customer View and Front Edit/Preview presentation.
- `src/scenario-flow.js` — app-owned scenario page/content defaults and guarded routing using the existing `Saving_Flow`, `Saving_Page_Content`, and `Saving_Routing` shapes.
- `src/main.js` — application orchestration and interaction events.
- `styles.css` — AVA Design System-aligned standalone composition and responsive rules.

## Checks

```sh
python3 tests/calculation.test.py
python3 tests/static_checks.py
```

See [`DATA_VALIDATION.md`](DATA_VALIDATION.md) for the captured official endpoint evidence and known limitations.

## Customer conversation paths

The first screen asks where to begin. 「未有特別安排」 enters the original P1 method → P2 purpose → P3–P7 path. Customers with existing tools select only 定期存款, 股票, ETF, and/or 債券, then explore a market, maturity, or combined visual. Customers already looking for a tool select one to three goals on the triangle and see the corresponding trade-off. Both additional paths join at the existing P2 purpose and P3 contribution screens; P4 shows only exact Official Saving values for those paths because no comparable return for a mixed portfolio or an unowned tool is inferred. P5–P7 and Customer View use the unchanged Saving calculation engine.

Scenario page metadata and entry/tool card copy use the existing flow/content merge and local User Override precedence. Existing Official rows with matching IDs can supply these presentation fields; no Sheet change or Official return-row change is required. P2–P4 display titles adapt to the new paths, with saved User title/subtitle overrides taking precedence; Official rows are not rewritten. Scenario selections, illustrative market numbers, and triangle state live only in the current customer session. `Saving_Routing` rows for the scenario route IDs are accepted only when they lead to the required next stage, so an Official content edit cannot skip the interactive explanation or the shared Saving entry.

The optional browser check is `python3 tests/scenario_browser_check.py` when Playwright and Chromium are available. It uses local HTTP and mocked Official GET responses backed by the checked-in exact return evidence; it is not a physical-device or installed-PWA certification.

## Admin capability audit

Saving has an existing `publish_content` Official-write architecture. This PR
connects it to AVA Platform Unified Admin Authentication and adds a Saving-owned
Admin surface for the existing Official configuration domains.

`?avaEntry=admin` requires a one-time Platform launch and fails closed without
it. Return tables and User/local overrides remain outside Admin publishing. See
[`ADMIN_INTEGRATION_AUDIT.md`](ADMIN_INTEGRATION_AUDIT.md).

## User pages and media

User-created content, Image pages (up to 6 references) and Video pages (1 reference) are stored as structured local overrides. Media binaries are never written to LocalStorage or backup JSON. The current independent preview has no connected Cloud Media Provider, so media references render a safe `媒體暫時無法使用` state until AVA Platform supplies an authorized provider. Portable backup preserves page order, visibility, content and media references without copying binary data; QR compatibility is represented as a platform-owned pointer contract rather than a Saving-specific QR implementation.
