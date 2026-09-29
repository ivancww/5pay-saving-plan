# 5PAY Saving Admin integration audit

## Result

Saving does not currently have a deployable true Admin capability in this
repository. The AVA Platform registry must remain `admin: false` until the
Saving-owned backend and its live deployment are supplied and reviewed.

## Existing architecture

- `src/data.js` reads the existing Saving GAS Web App through public
  read-only actions (`bootstrap`, `version`, `content`, and `returns`).
- `src/calculation.js` consumes the normalized Official payload and preserves
  Saving's exact-row multiplier, withdrawal, and remaining-value logic.
- `src/main.js` and `src/views.js` provide Frontstage and User/Edit behavior;
  edits are local presentation overrides only.
- There is no Saving-owned GAS write action, Sheet mutation, publishing flow,
  Official configuration editor, or Admin-only data surface in this repository.
- Google Sheet remains the Official source consumed by the existing GAS read
  path. No Saving product, calculation, withdrawal/return, mapping, customer
  flow, PWA, or User override behavior is moved to AVA Platform.

The live read payload exposes the following existing Official domains:
`system`, `flow`, `page_content`, `routing`, `current_methods`,
`withdrawal_strategies`, `customer_view`, and `return_tables`. The return-table
names and row fields are visible through the read contract, but the deployed
endpoint does not expose Sheet names, headers, write actions, or a schema
metadata action. The repository also does not contain the deployed GAS source.
Therefore the exact existing Sheet targets and writable field boundaries cannot
be established from this repository without guessing.

## Authentication decision

The Platform Unified Admin Authentication contract is conditional on an App
having an actual Admin capability. Saving's requested capability is currently
**BLOCKED**, not implemented: this repository does not add an auth client, App
grant storage, GAS exchange endpoint, or `official-write` call because the
Saving backend/deployment source and exact write targets are unavailable.

`?avaEntry=admin` is explicitly recognized and rendered as an unavailable
entry. It is never treated as authorization, does not load an Admin surface,
and does not perform a write. This preserves fail-closed behavior while
avoiding a second password, Google-email allowlist, frontend session token,
permanent URL credential, or fabricated business function.

## Blocking condition and required handoff

The write path must remain stopped until the owner supplies the deployed
Saving GAS source (or an approved source-controlled equivalent), the exact
Google Sheet tabs/headers for the existing domains, and a deployment path for
the Platform verification URL. Once available, the implementation can expose
only the validated Official fields, exchange the one-time launch server-side,
and call `verifyAppGrant` with `5pay` / `official-write` before every write.
No frontend-only or guessed Sheet mutation is acceptable.
