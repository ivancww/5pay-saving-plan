# 5PAY Saving Admin integration audit

## Result

Saving already had a genuine Official-write architecture: the existing
`publish_content` action writes six approved configuration domains. The missing
piece was Unified Admin Authentication and server-side authorization. This PR
adds that boundary without changing Saving product or calculation behavior.

## Existing Official write boundary

`publish_content` writes only these existing targets:

- `flow` → `Saving_Flow`
- `page_content` → `Saving_Page_Content`
- `routing` → `Saving_Routing`
- `current_methods` → `Saving_Current_Methods`
- `withdrawal_strategies` → `Saving_Withdrawal_Strategies`
- `customer_view` → `Saving_Customer_View`

Return tables remain read-only: `自動滾存`, `8年領取`, `15年領取`, `20年領取`,
`25年領取`, and `30年領取` are never publish targets. `Saving_System` is
protected; only the server-controlled `last_updated` update is performed after
a successful publish.

## Authentication boundary

The Admin entry requires the one-time `avaAdminLaunch` query value. Saving GAS
exchanges it server-to-server with AVA Platform using canonical App ID `5pay`,
then keeps the returned App Grant only in the Admin page's memory. Every
`publish_content` request calls Platform `verifyAppGrant` with `5pay` and
`official-write` before validation or any Sheet mutation.

No Saving password, email allowlist, Platform session token, persistent Admin
credential, User override mutation, or frontend-only authorization is used.
