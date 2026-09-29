# Saving GAS deployment

`Code.gs` is the source-controlled Saving Official backend. Deploy it as the
Saving-owned Google Apps Script Web App that serves the existing read contract.

Configure the deployment Script Property:

- `AVA_PLATFORM_ADMIN_ENDPOINT`: the AVA Platform Admin GAS Web App endpoint.

The Platform endpoint performs `exchangeAppLaunch` and `verifyAppGrant`. Saving
uses canonical App ID `5pay` and operation `official-write`; Saving never has a
second password and never stores the Platform session token.

Existing GET actions remain `bootstrap`, `content`, `returns`, `return`, and
`version`. POST supports `exchangeAppLaunch` and the existing
`publish_content`. Every publish verifies the App Grant before validating or
mutating any Sheet, then writes only `Saving_Flow`, `Saving_Page_Content`,
`Saving_Routing`, `Saving_Current_Methods`, `Saving_Withdrawal_Strategies`, and
`Saving_Customer_View`. Return sheets and `Saving_System` are not publish
targets; only the server-controlled `last_updated` value is updated.

Source implementation does not mean the deployed Web App is updated. A new
GAS deployment/version must be reviewed and deployed before Platform changes
the Saving registry from `admin: false` to `admin: true`.
