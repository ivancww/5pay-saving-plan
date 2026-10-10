# 5PAY Saving Admin integration audit

## Current result

Saving has a real Official-write surface for six existing configuration
domains. This change keeps that business boundary and strengthens the
Mother Standard evidence contract. It does not alter Saving calculations,
return tables, customer flow, User/local overrides, or Sheet names.

## Official write boundary

The `publish_content` action writes only:

- `flow` → `Saving_Flow`
- `page_content` → `Saving_Page_Content`
- `routing` → `Saving_Routing`
- `current_methods` → `Saving_Current_Methods`
- `withdrawal_strategies` → `Saving_Withdrawal_Strategies`
- `customer_view` → `Saving_Customer_View`

The return tables (`自動滾存`, `8年領取`, `15年領取`, `20年領取`,
`25年領取`, `30年領取`) and `Saving_System` remain protected from
frontend publication. The server may update only its controlled
`last_updated` value after a verified publish.

## Authentication boundary

The Admin entry requires a one-time `avaAdminLaunch` plus a
browser-bound `ava-admin-session-v1` proof from AVA Studio. Saving GAS
exchanges the proof through the Platform using App ID `5pay`, and verifies
the returned Admin session again for the operation
`5pay:official-write:<domain>`. The proof remains in memory only.

No Saving password, email allowlist, persistent Admin credential, User
override mutation, or frontend-only authorization is used. Saving does not
introduce the Medical Legacy App Grant exception.

## Read and revision contract

The read endpoints expose the existing Saving version fields plus a
canonical 64-character SHA-256 `revision`. Bootstrap, `version`, and
`checkVersion` use the same server-side revision source that is checked
before a write. The browser never generates a revision.

## Write confirmation contract

A successful `publish_content` response must include:

- the exact operation and published domain list;
- a complete server-read Official snapshot for the submitted domains;
- the canonical post-write revision;
- `persisted: true`;
- `read_after_write: true`.

The frontend compares every submitted domain snapshot with the returned
server snapshot. It does not treat HTTP 200 or `success:true` alone as
persistence evidence. If evidence is incomplete or mismatched, it keeps
the Admin draft visible and does not present a success state.

## Verification boundary

Source and mock contract tests are included in the repository. Production
GAS deployment, Google Sheets identity, and authenticated reversible write
E2E remain separate release gates. This PR does not deploy GAS, modify
Script Properties or Sheets, or perform a production Official Write.
