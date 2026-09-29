from pathlib import Path

gas = Path('gas/Code.gs').read_text()
admin = Path('src/admin.js').read_text()
main = Path('src/main.js').read_text()
integration = Path('src/integration.js').read_text()

for action in ['bootstrap', 'content', 'returns', 'return', 'version']:
    assert f"action === '{action}'" in gas
assert "body.action === 'exchangeAppLaunch'" in gas
assert "body.action === 'publish_content'" in gas
assert "verifyAppGrant_(body.appGrant);" in gas
assert gas.index('verifyAppGrant_(body.appGrant);') < gas.index('const validated = validatePublish_(body);') < gas.index('validated.forEach')
assert gas.index('validatePublishTargets_(validated);') < gas.index('validated.forEach(item => writeObjectsToSheet_')
assert "fields.forEach(key => { if (!Object.prototype.hasOwnProperty.call(row, key))" in gas
for domain in ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view']:
    assert f"'{domain}'" in gas and f"'{domain}'" in admin
for protected in ['return_tables', 'Saving_System', '自動滾存', '8年領取', '15年領取', '20年領取', '25年領取', '30年領取']:
    assert protected in gas
assert "if (!WRITE_DOMAINS.includes(key))" in gas
assert "verifyAppGrant" in gas and "appId: APP_ID" in gas and "operation: 'official-write'" in gas
assert "ENTRY_MODES.admin" in integration
assert "exchangeAdminLaunch" in main
assert "publishOfficial" in main
print('Saving GAS auth, allowlist, validation ordering, and Admin surface contract passed')
