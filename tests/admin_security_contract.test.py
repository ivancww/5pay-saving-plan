from pathlib import Path

runtime = ''.join(path.read_text() for path in [*Path('src').glob('*.js'), Path('index.html')])
admin = Path('src/admin.js').read_text()
main = Path('src/main.js').read_text()

assert "exchangeAppLaunch" in admin
assert "publish_content" in admin
assert "let adminAuthorization = null" in main
assert "history.replaceState" in main
assert "localStorage" not in admin
assert "sessionStorage" not in admin
assert "IndexedDB" not in runtime
assert "verifyAppGrant" not in admin
assert "appGrant" in admin
assert "appGrant" not in Path('src/portable.js').read_text()
print('Saving Admin grant is memory-only and frontend never performs Platform verification')
