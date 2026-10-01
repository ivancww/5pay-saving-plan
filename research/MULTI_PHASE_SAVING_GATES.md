# Multi-phase 5-year Saving — evidence gates

## Outcome

**BLOCKED for customer-facing multi-phase implementation.** This PR contains a read-only evidence snapshot, this report and a regression test. It does not enable phase controls, change session/product state, replace calculations or alter production assets.

Two required gates remain unresolved:

1. Genuine Official tables contain no local policy years 1–7. A started later phase must not be valued at zero or at its paid contributions as a substitute for a missing Official account-value row.
2. The repository and available Official metadata do not define the withdrawal mapping across separately shifted phases. Local-strategy reuse is a plausible design, not a verified existing multi-phase rule.

Adding P5 controls while leaving P4/P6/P7/Customer View unable to value those same phases would create an inconsistent production journey. The user explicitly permits no production change in this situation. No partial customer UI or unused production engine is introduced.

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

P4 and P6 use the `none` strategy. P4's Current Method uses `currentPath()` with a five-year contribution horizon and the chosen projection horizon. P5 explains the single five-year contribution journey. P7 has the five start strategies plus a forward rail restricted to the selected strategy's exact rows. Customer View independently calls the same single-block primitive using session strategy/year fields.

Customer state currently lives in one in-memory `state.session` across page navigation; it has no phase field or customer-session reload persistence. LocalStorage User Overrides are separate. No new state or migration is installed by this PR.

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

**Decision:** no early-year fallback exists in current logic or inspected history. Existing verified behavior is unavailable for a missing exact row. Do not use zero, paid contributions, interpolation, extrapolation, a nearest row, or an invented 10/15-year multiplier. Genuine years 1–7 or an explicit supported-timeline product decision are required before enabling affected calculations.

## Gate 2 — shifted withdrawal semantics

Genuine strategy metadata contains `strategy_code`, `sheet_name`, `start_year`, `withdraw_rate`, display/enabled/order fields. It has no multi-phase timing/mapping field. GAS reads those single-arrangement strategies and returns exact sheet rows. The existing primitive receives one policy year and one strategy; it does not establish how a customer-level choice applies across offsets.

| Selected local strategy | Phase 1 start under candidate A | Phase 2 under candidate A | Phase 3 under candidate A |
| --- | ---: | ---: | ---: |
| 8-year | 8 | 13 | 18 |
| 15-year | 15 | 20 | 25 |
| 20-year | 20 | 25 | 30 |
| 25-year | 25 | 30 | 35 |
| 30-year | 30 | 35 | 40 |

The table above is the consequence of candidate A (independent local strategies), **not verified product behavior**. Another customer-level mapping must not be inferred. Even candidate A would encounter Phase 2 local year 3 at overall year 8 and Phase 3 local year 5 at overall year 15 when those phases are active; their account values cannot be silently omitted because withdrawals have not started.

Verified single-block rules to preserve once the mapping is resolved:

- `annualUsable` uses the selected exact row's withdrawal rate, with the existing strategy-rate fallback and start-year gate.
- `cumulativeUsed` sums the existing table rows from the strategy start through the selected year. Sparse absent years are not generated; this existing behavior must not be replaced with years-times-rate arithmetic.
- `remainingValue` equals the exact selected multiplier times the five-year contribution basis. It already represents remaining/account value; do not deduct cumulativeUsed again.

**Decision:** BLOCKED. A genuine product rule or existing authoritative implementation must establish A versus another mapping, treatment before each phase's withdrawal starts, and customer-facing meaning of the shared start rail. Code feasibility alone does not verify that decision.

## Requested model and page decisions

This describes the approved shape from the user's request, not shipped functionality.

| Phase | Contribution window | Offset | Default |
| --- | --- | ---: | --- |
| 第一期 | Overall 1–5 | 0 | Active |
| 第二期 | Overall 6–10 | 5 | Hidden and excluded until explicitly added |
| 第三期 | Overall 11–15 | 10 | Hidden and excluded; requires 第二期 |

Removal must cascade from Phase 2 to Phase 3. Future aggregation belongs above unchanged `calculateOfficial()` in one reusable helper. Paid contributions must count only elapsed contribution years, up to five per started phase; that contribution count is not a substitute for missing Official value rows. Existing sessions without a phase field must default to Phase 1 only.

| Surface | Planned safe behavior after gates clear | This PR |
| --- | --- | --- |
| P4 | Option B: initial Phase 1; revisit after explicit P5 activation uses current phases. No historical pre-P4 selector was found. Compare the same contribution arrangement and time horizon. | Unchanged, single block |
| P5 | Progressive first/second/third phase reveal with add/remove controls and cascading removal. | Unchanged; no optional activation |
| P6 | Inherit P5 state; one total only when every started active phase has its required genuine row. | Unchanged, single block |
| P7 | Inherit the same phases; aggregation depends on verified withdrawal mapping. Preserve both rails and dependent reset. | Unchanged, single block |
| Customer View | Use the same resolved phases, strategy, overall year and result as P7. | Unchanged; no multi-phase snapshot |

Customer View dependency deserves care during future implementation: P7 can render `points[0]` and the first eligible year as fallbacks without persisting them, whereas Customer View reads `withdrawalStrategyCode || strategyCode` and `withdrawalPolicyYear || policyYear`. Direct presentation without explicit P7 selection may therefore use different fallback inputs. This is an existing source-level observation, not a new regression or a fix in this blocked PR. A future shared resolved-result helper should avoid extending that inconsistency to multi-phase totals.

## Validation and remaining work

- New `tests/multi_phase_evidence.test.py` executes the existing calculation primitive against all 194 genuine captured rows, missing early/sparse/out-of-range rows, offset examples and single-block withdrawal rules including no double deduction.
- Its customer contribution is a test input; no Official multiplier or withdrawal rate is synthetic.
- Full existing suite, including P3 live-input, PR #10 scroll lifecycle and automatic update contracts: passed alongside the new audit test (13 test files total).
- `git diff --check`: passed.
- Production source/assets, GAS, Admin/Auth, User Overrides and deployment/update workflow: unchanged by diff review.
- Phase activation/removal UI, portfolio aggregation, cross-phase P7/customer snapshots and their implementation tests: **NOT IMPLEMENTED / BLOCKED**, not claimed passing.
- New browser customer-flow, mobile/iPad/foldable/desktop layout, installed PWA and physical-device checks: **NOT VERIFIED**. No UI was changed; this PR does not claim responsive or physical-device certification.

To unblock: supply genuine missing rows or an explicit policy limiting affected timelines; establish the authoritative shifted withdrawal rule; then implement and test the shared model, progressive P5 state, page aggregation and consistent Customer View together. Do not turn research values into production defaults.
