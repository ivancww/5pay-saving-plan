from pathlib import Path

admin = Path('src/admin.js').read_text()
main = Path('src/main.js').read_text()
styles = Path('styles.css').read_text()
build = Path('src/build.js').read_text()

domains = ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view']
for domain in domains:
    assert f"data-admin-panel=\"${{domain}}\"" in admin
    assert f"data-admin-record-select=\"${{domain}}\"" in admin

# The previous implementation used hidden attributes, but the author stylesheet
# overrode the browser's hidden rule. Keep an explicit, higher-priority contract.
assert '.admin-domain[hidden],.admin-record[hidden]{display:none!important}' in styles
assert 'panel.hidden = panel.dataset.adminPanel !== domain' in admin
assert 'panel?.scrollIntoView?.({ block: \'start\', behavior: \'auto\' })' in admin
assert 'activeTab?.focus?.({ preventScroll: true })' in admin
assert 'handleAdminTabKeydown' in admin and 'ArrowRight' in admin
assert 'switchAdminRecord' in admin and 'data-admin-record-select' in main
assert 'href="#admin-panel-' not in admin
assert 'adminIsDirty(app)' in admin and '目前分區有未儲存修改' in admin
assert '目前記錄有未儲存修改' in admin and 'resetAdminTab(app)' in admin
assert 'data-admin-record-index' in admin and 'record.hidden = index !== selected' in admin

# The workspace no longer renders the oversized introductory card. Technical
# metadata is available only in a collapsed details section at the bottom.
assert 'admin-intro' not in admin
assert '<details class="admin-system-info"><summary>系統資訊</summary>' in admin
assert 'official?.revision || official?.version?.revision' in admin

# Security and data preservation remain on the existing path.
assert "5pay:official-write:configuration" in admin
assert 'payload.persisted !== true' in admin
assert 'payload.read_after_write !== true' in admin
assert 'data-row-json' in admin
assert "export const APP_VERSION = 'V1.8';" in build

print('true-tab Admin UX and compact-header contract passed')
