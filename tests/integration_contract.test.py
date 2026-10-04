from pathlib import Path

integration = Path('src/integration.js').read_text()
main = Path('src/main.js').read_text()
views = Path('src/views.js').read_text()
index = Path('index.html').read_text()

assert "value === ENTRY_MODES.frontend || value === ENTRY_MODES.user" in integration
assert "value === ENTRY_MODES.admin" in integration
assert "return ENTRY_MODES.unsupported" in integration
assert "entryMode === ENTRY_MODES.admin" in main
assert "startAdmin()" in main
runtime_source = ''.join(path.read_text() for path in [*Path('src').glob('*.js'), Path('index.html')])
assert "verifyAppGrant" not in runtime_source
assert "exchangeAppLaunch" in runtime_source
assert "state.mode = 'edit'" in main
assert "data-action=\"preview\"" in views
assert "data-action=\"save-preview\"" in views
assert "parentHref" in integration
assert "referrer" in integration
assert "avaSurface" in integration
assert "AVA_PLATFORM_URL" not in integration
assert "https://ivancww.github.io" not in integration
assert "entryMode === ENTRY_MODES.standalone" in main
assert "entryMode === ENTRY_MODES.unsupported" in main
assert 'const shouldRegisterServiceWorker = [' in main
for mode in ('standalone', 'frontend', 'user', 'admin'):
    assert f'ENTRY_MODES.{mode}' in main
assert "if (!shouldRegisterServiceWorker || !('serviceWorker' in navigator)) return;" in main
assert "loadCachedOfficial" in main
assert 'id="return-ava"' in index
assert "navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })" in main
print('independent app entry, edit-preview-save, return, and PWA boundary checks passed')
