# Phase 1 data validation

Captured from the official Saving GAS endpoint on 2026-09-23 UTC.

- Endpoint used: `https://script.google.com/macros/s/AKfycbw_tBrwEiGfaZSNBgLwv1eNyjG8KEWj0QeHZZPANh5endIuPfwl8HMT6LujWWqSXZaKRg/exec`
- Module: `Saving`
- Module version: empty in `action=version`
- Schema version: empty in `action=version`
- Data version: empty in `action=version`
- Actions executed successfully: `version`, `bootstrap`, `content`, `returns`
- Flow: P1 through P7 detected from `action=bootstrap` and `action=content`
- Return sheets detected: `自動滾存`, `8年領取`, `15年領取`, `20年領取`, `25年領取`, `30年領取`

Strategy mappings detected:

| Strategy | Official sheet | Start | Rate |
| --- | --- | ---: | ---: |
| `none` | `自動滾存` | — | 0% |
| `withdraw7_from8` | `8年領取` | 8 | 7% |
| `withdraw12_from15` | `15年領取` | 15 | 12% |
| `withdraw18_from20` | `20年領取` | 20 | 18% |
| `withdraw23_from25` | `25年領取` | 25 | 23% |
| `withdraw29_from30` | `30年領取` | 30 | 29% |

Supported policy years:

- `自動滾存`, `8年領取`, `15年領取`, `25年領取`, `30年領取`: 8–25, then 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100.
- `20年領取`: 8–25 excluding 21–24, then 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100.

Sample multipliers read directly from GAS:

| Sheet | Year 8 | Year 15 | Year 100 |
| --- | ---: | ---: | ---: |
| `自動滾存` | 1.16 | 1.86 | 480.3 |
| `8年領取` | 1.078284600389864 | 1.136686159844055 | 56.9374269005848 |
| `15年領取` | 1.16 | 1.714541910331384 | 34.66849902534113 |
| `20年領取` | 1.16 | 1.86 | 15.604 |
| `25年領取` | 1.16 | 1.86 | 60.341 |
| `30年領取` | 1.16 | 1.86 | 95.0647 |

## Calculation status

The multiplier basis is implemented as `total contribution × official multiplier`. This follows the Phase 1 P5 contract (“annual arrangement × 5 years = total contribution”) and is centralized in one adapter. The live GAS payload does not expose a separate `calculation_basis` field, so the basis is spec-derived rather than independently declared by the endpoint; this remains a product/data review item if the sheet owner defines a different base. The adapter uses exact official `policy_year` rows only. Unsupported years, missing strategies, malformed rows and missing contribution amounts return an unavailable state; no interpolation, extrapolation, `Math.pow`, fixed return, or fabricated fallback is used.

All official-value paths use the same adapter: P4, P6, P7 and Customer View.

## Limitations

- The endpoint returned blank module/schema/data version fields; the UI displays that limitation rather than inventing a version.
- Playwright browser checks were executed against a temporary local server at phone (390×844), folded-width phone (412×914), iPad portrait (834×1194), iPad landscape (1194×834), and unfolded/tablet-width (1800×1200) viewports. Boot, no-horizontal-overflow, P1→P7 flow, Customer View, local override/reset, actual back-history, exact-year selection, and service-worker registration passed. Physical iPadOS/HONOR device checks, installed Home Screen chrome, live CORS under deployment origin, and saving a native print dialog to a PDF file remain human/device verification items.
