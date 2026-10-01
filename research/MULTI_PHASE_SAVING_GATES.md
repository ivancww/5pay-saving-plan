# Multi-phase 5-year Saving — evidence gates

## Outcome after authoritative product decision

**Gate 2 RESOLVED BY AUTHORITATIVE PRODUCT DECISION (2026-10-01).** Each active phase independently selects its own withdrawal strategy; strategy year is local to that phase; each phase uses the unchanged verified single-block primitive; customer results aggregate afterward. The product decision comes from the user, not invented insurer/iPOS evidence.

**Gate 1 remains a genuine data limitation, handled through explicit availability.** Missing local years 1–7 (and other absent exact rows) are never estimated, valued at zero, or replaced by paid contributions. P4/P6 show a progressive known-value total: a later started phase without an exact row does not hide earlier exact values. Availability metadata and included-phase counts distinguish unavailable values from zero. P7 instead combines independently selected active phase scenarios; an unavailable selected scenario blocks the complete withdrawal summary.

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

The requested contribution windows and mapping are clear: offsets 0, 5, 10; local year = overall year minus offset. An optional phase is not started when the overall year has not exceeded its offset. Once started, missing value data stays unavailable. In accumulation it is excluded from the explicitly labelled current known-value total; it never becomes zero.

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

**Corrected authoritative decision:** no early-year financial fallback exists. P4/P6 display the sum of active phases with exact values, with customer wording identifying the number of included phases. At overall year 8 with all three active, only Phase 1 is value-available; at year 13 Phases 1+2; at year 18 all three. If no phase value is available, show unavailable. Contributions are independently knowable and do not replace unknown values. No zero, paid-contribution substitution, interpolation, extrapolation, nearest row or invented 10/15-year multiplier is used.

## Gate 2 — resolved independent withdrawal design

The original audit correctly found that genuine single-arrangement strategy metadata and repository history did not determine multi-phase timing. The user has now supplied the authoritative business rule:

- Each phase independently chooses local year 8 / 15 / 20 / 25 / 30.
- Its overall withdrawal start is its own offset plus its own selected start year.
- Phase 1, 2 and 3 may choose different strategies; selectors do not change phase activation.
- Each active phase independently selects its own local exploration year from its strategy's exact supported rows at or after its start. Customer age uses current age + phase offset + selected local year.
- Final 整體效果 combines the currently selected independent scenarios, which may be at different customer ages. It is not a common-age projection.

For example, Phase 1 choosing 15, Phase 2 choosing 8 and Phase 3 choosing 20 produces overall withdrawal starts 15 / 13 / 30. This is now supported product behavior, not a claim derived from previously absent insurer evidence.

Verified single-block rules remain unchanged:

- `annualUsable` uses the exact row's withdrawal rate, with existing strategy-rate fallback and start-year gate.
- `cumulativeUsed` sums existing rows from that phase's strategy start through its selected local year. No withdrawal rows are created for sparse years.
- `remainingValue` is exact multiplier times that phase's five-year contribution basis. CumulativeUsed is not deducted again.

For P7, the combined three financial metrics are withheld if any selected active phase result is unavailable. No unavailable selection silently becomes zero. This differs intentionally from P4/P6 progressive accumulation.

## Implemented model and customer journey

`src/calculation.js` keeps the original `calculateOfficial()` and `currentPath()` primitives unchanged, then adds reusable phase definitions, legacy-safe active-phase resolution, a progressive accumulation resolver, an independent phase withdrawal resolver, and a withdrawal summary aggregator shared by P7/Customer View. This uses an existing cached module, so no Service Worker shell dependency or update architecture change is needed.

| Phase | Contribution window | Offset | Default |
| --- | --- | ---: | --- |
| 第一期 | Overall 1–5 | 0 | Active |
| 第二期 | Overall 6–10 | 5 | Hidden/excluded until explicitly added |
| 第三期 | Overall 11–15 | 10 | Hidden/excluded; requires 第二期 |

`session.savingPhases` stores contiguous active phases, each with its own `strategyCode` and local `withdrawalPolicyYear`. Each phase defaults independently to its first available genuine start/year until selected. Changing a strategy resets only that phase's dependent local year; changing its exploration year leaves all other phases untouched. No authoritative shared `withdrawalOverallYear` remains.

State helpers add only the next phase, cap at three, remove Phase 3, or cascade removal from Phase 2. Remaining phases keep both selections; removed phases have no retained hidden influence. Legacy `withdrawalStrategyCode` / `withdrawalPolicyYear` seed Phase 1 without activating optional phases. An older phase entry without a year can seed Phase 1 from the legacy local-year field. Once a new phase-local year exists, neither old local state nor obsolete shared overall state overrides it. Supplied unsupported local selections remain unavailable; no nearest-year replacement occurs.

Paid contributions count only elapsed contribution years, capped at five for each started phase. This separately known input total is labelled as paid contributions; it never stands in for missing account value. The planned five-year contribution basis still applies independently inside the verified primitive.

| Surface | Implemented behavior |
| --- | --- |
| P4 | Initially Phase 1. On revisit, uses the active phases established in P5. Current Method still has its original five-year contribution horizon; multi-phase comparison wording explicitly distinguishes that horizon from the chosen Saving phases. No duplicate selector. |
| P5 | Compact progressive phase cards, correct 1–5 / 6–10 / 11–15 windows and equal annual/five-year inputs. Add-next controls; removal cascades. Technical terms are absent from customer copy. |
| P6 | Inherits phase state. One progressive 累積 Saving 價值, included-value phase count, and paid contributions to the selected overall time. Later unavailable values do not hide earlier exact values. |
| P7 | Each active phase has an independent start rail, local exploration rail, and three compact metrics; a final summary combines the current independent scenarios. The duplicated large hero/value card is removed without a placeholder gap. |
| Customer View | Same independent scenarios and summary as P7, with each phase's start, exploration year, actual age and compact result context. No common-age claim; defaults and availability match P7. Existing report composition and PDF action retained. |

P7 uses only exact supported local rows at or after each phase's chosen start. The old shared overall exploration architecture is removed. Each customer-age label includes that phase's offset; the secondary year label remains local to that explicitly named phase.

Stable IDs are `withdrawal-start-rail` / `withdrawal-explore-rail` for Phase 1, with `-2` and `-3` suffixes for Phases 2/3. PR #10's synchronous stable-ID/context snapshot and restoration remains intact. Strategy selection resets only the same phase's exploration year and rail. All unrelated rails preserve position. Normal exploration clicks restore all unchanged rail positions. No UA, timeout, scrollIntoView or forced smooth scroll is used.

## Validation of corrected behavior

- Full suite: **14 Python test files pass**, including static checks and Node runtime/render regressions.
- Genuine archive runtime cases, all three phases active: overall 8 displays Phase 1; 13 displays Phases 1+2; 18 displays Phases 1+2+3. Values equal calls to the unchanged single-block primitive; missing early values remain undefined, with explicit started/available metadata and included-phase counts. P4/P6 rendered amounts match.
- Independent P7 runtime choices: strategy/local exploration 15/40, 8/25, 20/30; six rails, three separate metric groups, and one final summary. Summary equals the three exact primitive results. Sparse cumulative rows are summed row-by-row; remainingValue has no second deduction.
- Strategy and exploration updates preserve other phases' selections; optional phases remain absent until activation. Removal cascades and preserves surviving selections. Legacy state and obsolete shared-time isolation are tested.
- All six P7 rails execute the actual synchronous draw/render lifecycle: capture before replacement, restore afterward, and reset only the selected phase's dependent rail. P4/P6, page/context isolation and P3 live typing regressions remain covered.
- Customer View matches summary metrics, contains each selected phase's start/time/age/result, and shares unavailable behavior.
- Genuine evidence tests exercise all 194 captured rows and early/sparse/out-of-range gaps; original snapshot unchanged.
- Synthetic fixtures test mechanics only and never enter product data.
- `git diff --check`: passed. Original single-block and Current Method primitives, genuine snapshot, Official loader, GAS/Admin/Auth, Service Worker and deployment/update workflow unchanged.

## Browser and remaining verification

Chromium/Headless Shell is not installed in the execution environment. Attempted headless-shell installation failed because downloaded archives were invalid. A separate available Cloud Browser was also attempted against the local preview, but navigation was blocked by `net::ERR_BLOCKED_BY_CLIENT`; it could not access the application. Browser customer-flow, gesture behavior, actual page-overflow checks at phone portrait/landscape, iPad portrait/landscape, foldable narrow/wide and desktop, installed PWA, print-dialog/PDF appearance and physical-device checks remain **NOT VERIFIED / browser QA pending**.

Static structure retains `touch-action:pan-x pan-y`, bounded rail overflow, shared ageYearRail, minimum-width-zero result tracks, wrapping phase controls and existing AVA responsive boundaries. This is structural inspection, not a browser or physical-device PASS.

Gate 1 remains an ongoing data coverage limitation, not an unfinished guessed calculation: missing individual values remain unavailable. P4/P6 show explicitly labelled known-value totals progressively; P7 requires every selected active scenario for its complete summary. Current-flow phase state is not persisted across reload, matching the existing customer-session lifecycle. User Overrides are not modified or repurposed for product state. Do not merge automatically.

## Previous correction workflow and subsequent recovery

GitHub reports PR #11 was already merged at 2026-10-01 04:30:37 UTC, merge commit `aa6f7de72b59092a76dc1da3fea8dcfc8385b424`. A read-only fetch independently confirms that commit is current `origin/main`. The existing research branch remains at reviewed remote HEAD `9e8ab4196ce9b9f10e81b9ed3649961b6d1870d6`. Corrections and passing tests were completed locally on the existing branch. No new branch/PR, remote code write, or merge was performed during this correction. Updating the same merged PR as a reviewable code change is blocked; a revised workflow requires the user's instruction.

The subsequent user instruction authorizes a new correction PR. Recovery found the complete implementation in local commit `d096ea001aa69bd5c86b7e2a750596481871406d` on `research/multi-phase-saving-evidence-gates`, with a clean working tree and no pushed correction. Latest fetched main is `aa6f7de72b59092a76dc1da3fea8dcfc8385b424`, containing merged PR #11. The exact correction was cherry-picked onto `fix/multi-phase-progressive-autonomy` based on that main; a tree comparison confirmed identical recovered contents before this documentation-only update. No implementation was restarted, and the original research branch/commit remains preserved. All 14 test files and diff whitespace checks were rerun successfully. One correction PR is authorized; no merge is authorized. Browser limitations above remain unchanged.
