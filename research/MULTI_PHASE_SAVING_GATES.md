# Multi-phase 5-year Saving — evidence gates

## Outcome after authoritative product decision

**Gate 2 RESOLVED BY AUTHORITATIVE PRODUCT DECISION (2026-10-01).** Each active phase independently selects its own withdrawal strategy; strategy year is local to that phase; each phase uses the unchanged verified single-block primitive; customer results aggregate afterward. The product decision comes from the user, not invented insurer/iPOS evidence.

**Gate 1 remains a genuine data limitation, handled through explicit availability.** Missing local years 1–7 (and other absent exact rows) are never estimated, valued at zero, or replaced by paid contributions. Any started unavailable phase blocks the complete portfolio financial values. A not-started phase is excluded from that time's value.

PR #11 now implements the coherent customer framework across P4/P5/P6/P7/Customer View. The original genuine snapshot is retained byte-for-byte. Code/runtime tests are complete; browser QA is pending because the Chromium Headless Shell download returned invalid archives. No physical-device certification is claimed.

## Starting point and authoritative sources

- Repository: `ivancww/5pay-saving-plan`.
- Latest main studied: `4cf1a746ba0018e83198ce7db6f2401107ef73a6`, merge of PR #10.
- Scoped/root AGENTS files: none present in this App's tracked main tree.
- Latest Platform main documents read: `AGENTS.md`, `docs/MOTHER-RULES.md`, `design-system/DESIGN-SYSTEM.md`.
- Platform document blob SHAs: AGENTS `0c29e6c7bdfdefeaff39188d031140f3cd7ba50d`; Mother Rules `22764350305384d9d45b6d6bf5635d276a00d59c`; Design System `2208c3a0b1f0a113a312a46dfd2bc24f55114deb`.
- App sources: `src/calculation.js`, `src/state.js`, P4–P7 and Customer View in `src/views.js`, orchestration in `src/main.js`, normalization in `src/data.js`, read/strategy schemas in `gas/Code.gs`, `DATA_VALIDATION.md` and relevant regressions.

No other repository was modified. This is not a full Platform study or an Integration Readiness certification.

## Existing architecture and history

`calculateOfficial()` values one five-year arrangement with basis `annualContribution × 5`. It finds the exact requested `policy_year`; a missing row returns `available: false` with no financial value. `supportedYears()` enumerates existing rows without generating new years.

P4 and P6 use the `none` strategy. P4's Current Method uses `currentPath()` with a five-year contribution horizon and the chosen projection horizon. P5 explains the single five-year contribution journey. P7 has the five start strategies plus a forward rail restricted to the selected strategy's exact rows. Before this change, Customer View independently called the same single-block primitive using session strategy/year fields. It now consumes the same resolved withdrawal portfolio as P7.

Before implementation, customer state lived in one in-memory `state.session` across page navigation without phase fields. The new phase configuration remains in that current-flow session; it persists across page/mode navigation, not across a session reset or reload. LocalStorage User Overrides remain separate and unchanged.

Targeted searches covered fetched branch history for phase/portfolio/offset/local-year identifiers, repeated Saving, Chinese first/second/third phase labels, and 10/15-year contribution terms. No earlier multi-phase Saving implementation or verified pre-P4 phase-selection design was found in the inspected repository history. The original `868e60d` implementation already used one five-year basis. Hits for “Phase 1” refer to project delivery, and hits for 15-year terms identify withdrawal strategies, not a 15-year contribution product.

Relevant history:

| Commit | Evidence |
| --- | --- |
| `868e60d` | Original single five-year adapter/state; no shifted phases |
| `5aa37b2` | Strategy sheet lookup hardening; still one arrangement |
| `b69a8b1` | P7 start/forward-year exploration; no phase mapping |
| `54057e7` | Current Method contribution horizon separated from projection; cumulative withdrawal changed to exact row-by-row sum |
| `29e96ce` | Shared ageYearRail and P3 live-input behavior |
| `652e2dd` | Synchronous rail scroll capture/restore, independent P7 reset behavior |

Absence in inspected history is not proof that no design ever existed outside this repository.

## Genuine current data

Read-only GETs to the exact endpoint configured in `src/data.js` succeeded for `bootstrap`, `returns`, and `version` on 2026-10-01 UTC. Bootstrap return tables and the separate returns response were identical. The research snapshot records the endpoint, actions, filesystem capture timestamps and hashes of locally JSON-formatted full responses. The archived table entries and strategy fields are genuine, not synthetic. They are not loaded by the production App.

Snapshot: [`evidence/official-return-audit-2026-10-01.json`](evidence/official-return-audit-2026-10-01.json).

| Official sheet | Exact local policy years | Rows |
| --- | --- | ---: |
| 自動滾存 | 8–25 inclusive; then 30–100 every 5 years | 33 |
| 8年領取 | 8–25 inclusive; then 30–100 every 5 years | 33 |
| 15年領取 | 8–25 inclusive; then 30–100 every 5 years | 33 |
| 20年領取 | 8–20 inclusive, 25; then 30–100 every 5 years | 29 |
| 25年領取 | 8–25 inclusive; then 30–100 every 5 years | 33 |
| 30年領取 | 8–25 inclusive; then 30–100 every 5 years | 33 |

Total: 194 rows. All six sheets lack years 1–7. All are sparse after year 25; the 20-year strategy also lacks years 21–24. No row above year 100 exists in this capture. The version response identifies Saving but leaves module/schema/data version and last_updated blank; no version was invented.

This confirms and refreshes the 2026-09-23 capture in `DATA_VALIDATION.md`. Endpoint access does not independently certify insurer/iPOS provenance or the underlying sheet owner's proposed future business rules.

## Gate 1 — early local years

The requested contribution windows and mapping are clear: offsets 0, 5, 10; local year = overall year minus offset. An optional phase is not started when the overall year has not exceeded its offset. Once started, missing value data cannot be excluded from a purported complete portfolio total.

| Overall year | Phase 1 | Phase 2 | Phase 3 |
| ---: | --- | --- | --- |
| 8 | Local 8: exact | Local 3: **missing** | Not started |
| 10 | Local 10: exact | Local 5: **missing** | Not started |
| 11 | Local 11: exact | Local 6: **missing** | Local 1: **missing** |
| 13 | Local 13: exact | Local 8: exact | Local 3: **missing** |
| 15 | Local 15: exact | Local 10: exact | Local 5: **missing** |
| 18 | Local 18: exact | Local 13: exact | Local 8: exact |
| 20 | Local 20: exact | Local 15: exact | Local 10: exact |

Phase 2 maps to missing local years during overall years 6–12. Phase 3 does so during overall years 11–17. These include completed contribution windows: paid contributions do not establish a surrender/account-value multiplier for local year 5, 6 or 7.

For accumulation, restricting the **existing** overall rail to complete exact-row intersections would leave years 13–25, then 30–100 in 5-year steps for two phases; years 18–25, then 30–100 in 5-year steps for three phases. These are data-coverage observations only. No such rail restriction was implemented, and it does not resolve withdrawal semantics.

**Decision:** no early-year financial fallback exists. The user has explicitly authorized showing a customer-safe unavailable state at affected overall years. The account-value aggregate is available only when all started active phases have exact rows. No zero, paid-contribution substitution, interpolation, extrapolation, nearest row or invented 10/15-year multiplier is used.

## Gate 2 — resolved independent withdrawal design

The original audit correctly found that genuine single-arrangement strategy metadata and repository history did not determine multi-phase timing. The user has now supplied the authoritative business rule:

- Each phase independently chooses local year 8 / 15 / 20 / 25 / 30.
- Its overall withdrawal start is its own offset plus its own selected start year.
- Phase 1, 2 and 3 may choose different strategies; selectors do not change phase activation.
- At one overall exploration year, each started phase maps independently to its local year and exact selected strategy row.

For example, Phase 1 choosing 15, Phase 2 choosing 8 and Phase 3 choosing 20 produces overall withdrawal starts 15 / 13 / 30. This is now supported product behavior, not a claim derived from previously absent insurer evidence.

Verified single-block rules remain unchanged:

- `annualUsable` uses the exact row's withdrawal rate, with existing strategy-rate fallback and start-year gate.
- `cumulativeUsed` sums existing rows from that phase's strategy start through its selected local year. No withdrawal rows are created for sparse years.
- `remainingValue` is exact multiplier times that phase's five-year contribution basis. CumulativeUsed is not deducted again.

The combined three financial metrics are withheld together if any started phase lacks a required row. This avoids presenting either a partial account-value sum or partial withdrawal metrics as the complete arrangement.

## Implemented model and customer journey

`src/calculation.js` keeps the original `calculateOfficial()` and `currentPath()` primitives unchanged, then adds reusable phase definitions, legacy-safe active-phase resolution, one portfolio aggregator and one P7/Customer View resolver. This uses an existing cached module, so no Service Worker shell dependency or update architecture change is needed.

| Phase | Contribution window | Offset | Default |
| --- | --- | ---: | --- |
| 第一期 | Overall 1–5 | 0 | Active |
| 第二期 | Overall 6–10 | 5 | Hidden/excluded until explicitly added |
| 第三期 | Overall 11–15 | 10 | Hidden/excluded; requires 第二期 |

`session.savingPhases` stores the contiguous active phases and their independent strategy codes. `session.withdrawalOverallYear` stores the one exploration year. State helpers in `src/state.js` add only the next phase, cap at three, remove Phase 3, or cascade removal from Phase 2 to Phase 3. Removed strategies are not retained for later reactivation. Legacy `withdrawalStrategyCode` and `withdrawalPolicyYear` map safely to Phase 1/overall time without enabling another phase. An unselected phase uses the first available genuine start choice, preserving the old single-phase default; P7 and Customer View resolve that default identically.

Paid contributions count only elapsed contribution years, capped at five for each started phase. This separately known input total is labelled as paid contributions; it never stands in for missing account value. The planned five-year contribution basis still applies independently inside the verified primitive.

| Surface | Implemented behavior |
| --- | --- |
| P4 | Initially Phase 1. On revisit, uses the active phases established in P5. Current Method still has its original five-year contribution horizon; multi-phase comparison wording explicitly distinguishes that horizon from the chosen Saving phases. No duplicate selector. |
| P5 | Compact progressive phase cards, correct 1–5 / 6–10 / 11–15 windows and equal annual/five-year inputs. Add-next controls; removal cascades. Technical terms are absent from customer copy. |
| P6 | Inherits phase state. One 累積 Saving 價值 plus paid contributions to the selected time. Exact or explicitly unavailable complete total. |
| P7 | One independent start rail per active phase; one overall exploration rail; three combined metrics. The duplicated large hero/value card is removed without a placeholder gap. |
| Customer View | Same resolver, active phases, independent strategies, selected overall year, combined metrics and availability as P7, including default selections before an explicit click. Existing report composition and PDF action retained. |

P7's overall year choices are the sorted union of each active strategy's exact row years shifted by its phase offset, starting at the earliest active withdrawal start. No interpolated year choices are created. Some points have data for only part of the arrangement: those points remain explorable but show unavailable complete totals. Beyond a particular phase's last exact year, its absence also blocks the total; no extrapolation is performed.

Stable strategy rail IDs are `withdrawal-start-rail`, `withdrawal-start-rail-2`, and `withdrawal-start-rail-3`; the single exploration ID remains `withdrawal-explore-rail`. PR #10's synchronous snapshot/restore lifecycle is unchanged. Changing or reselecting a phase start resets the overall exploration year to that phase's overall start and resets only the dependent exploration rail. Since that point may follow another phase's earlier start, the explicit reset synchronously aligns the chosen overall card using its measured position. Normal age/year selections only restore browsing position; no scrollIntoView, timeout or smooth-scroll behavior is added. All unchanged strategy rails preserve their own position. Selection is excluded from their identity context; the overall rail's context includes the active independent strategies and exact overall choices.

## Validation

- Full suite: **14 Python test files pass**, including Node runtime product and real-render tests.
- New `tests/multi_phase_runtime.test.py`: default/legacy state, activation/removal/cascade, P5 progressive reveal/windows, P4 return navigation and unchanged Current Method horizon, one/two/three-phase P6 values, exact mapping, partial contributions, missing-row blocking, independent 15/8/20 strategies, shifted starts, sparse cumulative withdrawals, no double deduction, inactive/not-started exclusion, removed P7 hero, one overall rail, and matching Customer View.
- Expanded `tests/timeline_scroll.test.py`: P4/P6 plus all three P7 strategy rails independently preserve positions, overall rail resets only on start selection, unrelated strategies retain position, no cross-page leaks and P3 input handling remains intact.
- Genuine audit test still exercises all 194 captured rows and missing early/sparse/out-of-range rows. Snapshot is unchanged.
- Synthetic unit fixtures are labelled test mechanics; no synthetic value enters Official or production data.
- Existing source-level regressions updated only where the old single-phase contract was explicitly superseded; financial, GAS/Admin, portable data and automatic-update tests still pass.
- `git diff --check`: passed.
- Diff review: `calculateOfficial()`, `currentPath()`, `src/data.js`, Admin/Auth, GAS, genuine archive, Service Worker and deployment/update workflow unchanged.

## Browser and remaining verification

Chromium/Headless Shell is not installed in the execution environment. Attempted headless-shell installation failed because downloaded archives were invalid. A separate available Cloud Browser was also attempted against the local preview, but navigation was blocked by `net::ERR_BLOCKED_BY_CLIENT`; it could not access the application. Browser customer-flow, gesture behavior, actual page-overflow checks at phone portrait/landscape, iPad portrait/landscape, foldable narrow/wide and desktop, installed PWA, print-dialog/PDF appearance and physical-device checks remain **NOT VERIFIED / browser QA pending**.

Static structure retains `touch-action:pan-x pan-y`, bounded rail overflow, shared ageYearRail, minimum-width-zero result tracks, wrapping phase controls and existing AVA responsive boundaries. This is structural inspection, not a browser or physical-device PASS.

Gate 1 remains an ongoing data coverage limitation, not an unfinished guessed calculation: affected customer values explicitly remain unavailable until genuine rows exist. Current-flow phase state is not persisted across reload, matching the existing customer-session lifecycle. User Overrides are not modified or repurposed for product state. Do not merge automatically.
