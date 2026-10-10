from pathlib import Path

gas = Path('gas/Code.gs').read_text()

assert "if (action === 'bootstrap')" in gas
assert "if (action === 'content')" in gas
assert "if (action === 'returns')" in gas
assert "if (action === 'return')" in gas
assert "if (action === 'version' || action === 'checkVersion')" in gas
assert "getReturnSheetFromStrategy_(e.parameter.strategy)" in gas
assert "function getReturnSheetFromStrategy_(strategy)" in gas
assert "rows_(SHEETS.withdrawal_strategies)" in gas
assert "function readReturnSheet_(sheetName)" in gas
assert "SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)" in gas
assert "values.shift()" in gas
assert "policy_year: normalizeNumber_(row[0])" in gas
assert "withdrawal_rate: normalizePercent_(row[1])" in gas
assert "multiplier: normalizeNumber_(row[2])" in gas
assert "value.replace(/,/g, '')" in gas
assert "value.trim().endsWith('%')" in gas
assert "number > 1 ? number / 100" not in gas
assert "system: getSystemData_()" in gas
assert "function getVersionInfo_()" in gas
assert "function officialRevision_()" in gas
assert "Utilities.DigestAlgorithm.SHA_256" in gas
assert "revision: officialRevision_()" in gas
assert "function readOfficialSnapshot_()" in gas
assert "module_name" in gas and "module_version" in gas and "schema_version" in gas
assert "data_version" in gas and "last_updated" in gas
assert "function readContent_()" in gas
for domain in ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view']:
    assert f'{domain}:' in gas
assert "return_tables: readReturnTables_()" in gas
print('Saving GET/read, return normalization, bootstrap, and version contracts preserved')
