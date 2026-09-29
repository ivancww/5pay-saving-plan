# 5PAY Saving Admin integration audit

## Result

Saving does not currently have a true Admin capability. The AVA Platform
registry must remain `admin: false`, and AVA Platform must not expose a Saving
Admin launch.

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

## Authentication decision

The Platform Unified Admin Authentication contract is conditional on an App
having an actual Admin capability. Since Saving has no Official write to
protect, this repository does not add an auth client, App grant storage, GAS
exchange endpoint, or `official-write` call.

`?avaEntry=admin` is explicitly recognized and rendered as an unavailable
entry. It is never treated as authorization, does not load an Admin surface,
and does not perform a write. This preserves fail-closed behavior while
avoiding a second password, Google-email allowlist, frontend session token,
permanent URL credential, or fabricated business function.

If Saving later gains a genuine Official configuration/write requirement, the
next implementation must be a separate reviewed capability change: AVA
Platform registry `admin: true`, canonical App ID `5pay`, one-time
`avaAdminLaunch` exchange in Saving backend/GAS, and server-side
`verifyAppGrant(appId: "5pay", operation: "official-write")` before every
validated Official write. That future work is intentionally not implemented
by this audit.
