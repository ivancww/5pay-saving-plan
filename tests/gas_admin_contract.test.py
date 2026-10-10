from pathlib import Path

gas = Path('gas/Code.gs').read_text()
admin = Path('src/admin.js').read_text()
main = Path('src/main.js').read_text()
integration = Path('src/integration.js').read_text()

for action in ['bootstrap', 'content', 'returns', 'return', 'version']:
    assert f"action === '{action}'" in gas
assert "body.action === 'exchangeAdminSession'" in gas
assert "body.action === 'publish_content'" in gas
assert "adminSessionProof" in gas and "JSON.stringify({ action: 'publish_content', adminSessionProof, appId: APP_ID, operation, expectedVersion: expectedRevision, data })" in admin
assert "verifyAdminSession_(body.adminSessionProof" in gas
assert gas.index('const validated = validatePublish_(body.data);') < gas.index('validated.forEach(item => verifyAdminSession_(body.adminSessionProof') < gas.index('validated.forEach(item => snapshots.push')
assert gas.index('validatePublishTargets_(validated);') < gas.index('validated.forEach(item => writeObjectsToSheet_')
assert "fields.forEach(key => { if (!Object.prototype.hasOwnProperty.call(row, key))" in gas
for domain in ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view']:
    assert f"'{domain}'" in gas and f"'{domain}'" in admin
for protected in ['return_tables', 'Saving_System', '自動滾存', '8年領取', '15年領取', '20年領取', '25年領取', '30年領取']:
    assert protected in gas
assert "if (!WRITE_DOMAINS.includes(key))" in gas
assert "verifyAdminSession" in gas and "appId: APP_ID" in gas and "official-write" in gas
assert "getReturnSheetFromStrategy_(e.parameter.strategy)" in gas
assert "normalizeNumber_" in gas and "normalizePercent_" in gas
assert "system: getSystemData_()" in gas
for field in ['module_name', 'module_version', 'schema_version', 'data_version', 'last_updated']:
    assert field in gas
assert "ENTRY_MODES.admin" in integration
assert "exchangeAdminLaunch" in main
assert "publishOfficial" in main
print('Saving GAS auth, allowlist, validation ordering, and Admin surface contract passed')
