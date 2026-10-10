from pathlib import Path

admin = Path('src/admin.js').read_text()
data = Path('src/data.js').read_text()
main = Path('src/main.js').read_text()
styles = Path('styles.css').read_text()

domains = ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view']
for domain in domains:
    assert f"  {domain}:" in admin
    assert f'data-admin-domain="${{domain}}"' in admin or domain in admin

# The Admin is structured by record and field; raw JSON is not its primary editor.
assert 'data-admin-row' in admin
assert 'data-admin-field' in admin
assert 'ADMIN_FIELD_DEFINITIONS' in admin
assert 'admin-json' not in admin
assert '驗證並儲存官方資料' in admin
assert '放棄本頁修改' in admin
assert 'switchAdminTab' in admin and 'resetAdminTab' in admin

# Every current Saving GAS write schema has a matching UI field definition.
schemas = {
    'flow': ['page_id', 'order', 'page_type', 'title', 'subtitle', 'enabled', 'skippable'],
    'page_content': ['content_id', 'page_id', 'content_type', 'order', 'headline', 'subtext', 'action_key', 'enabled'],
    'routing': ['route_id', 'method_key', 'reason_key', 'visualization_type', 'next_page', 'enabled'],
    'current_methods': ['method_key', 'display_name', 'model_type', 'assumption_source', 'future_rule', 'visual_title', 'enabled'],
    'withdrawal_strategies': ['strategy_code', 'display_name', 'start_year', 'withdraw_rate', 'sheet_name', 'enabled', 'sort_order'],
    'customer_view': ['block_id', 'order', 'block_type', 'title', 'subtitle', 'enabled'],
}
gas = Path('gas/Code.gs').read_text()
for domain, fields in schemas.items():
    for field in fields:
        assert f"'{field}'" in gas
        assert f"['{field}'" in admin or f", ['{field}'" in admin or f"['{field}'," in admin

# Disabled rows are retained for Admin rather than being lost by Frontstage normalization.
assert 'const admin = {' in data
assert 'official.admin = admin' in data
assert 'official.admin || official' in admin
assert "const operation = '5pay:official-write:configuration'" in admin
assert 'payload.persisted !== true' in admin
assert 'payload.read_after_write !== true' in admin
assert "expectedRevision" in admin
assert 'switchAdminTab(app, control.dataset.domain)' in main
assert "action === 'admin-reset'" in main
assert 'admin-field-grid' in styles and 'admin-tabs' in styles

print('structured Chinese Saving Admin editor contract passed')
