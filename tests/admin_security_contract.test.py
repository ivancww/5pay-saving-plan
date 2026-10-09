from pathlib import Path

runtime = ''.join(path.read_text() for path in [*Path('src').glob('*.js'), Path('index.html')])
admin = Path('src/admin.js').read_text()
main = Path('src/main.js').read_text()

assert "exchangeAdminSession" in admin
assert "publish_content" in admin
assert "let adminAuthorization = null" in main
assert "history.replaceState" in main
assert "localStorage" not in admin
assert "sessionStorage" not in admin
assert "IndexedDB" not in runtime
assert "verifyAdminSession" not in admin
assert "adminSessionProof" in admin
assert "adminSessionProof" not in Path('src/portable.js').read_text()
assert "browserProofFromContext" in admin
assert "browserWindow.name = ''" in admin
assert "data.appId !== APP_ID" in admin
assert "data.launchTicket !== launchTicket" in admin
assert "data.launchNonce !== launchNonce" in admin
assert "expiry <= Date.now()" in admin
assert admin.index("const contextProof = browserProofFromContext") < admin.index("if (!window.opener)")
print('Saving Admin grant is memory-only and frontend never performs Platform verification')
