from pathlib import Path

root = Path('.')
audit = (root / 'ADMIN_INTEGRATION_AUDIT.md').read_text()
runtime = ''.join(path.read_text() for path in [*Path('src').glob('*.js'), root / 'index.html'])

# The existing Saving deployment is read-only. Keep the requested Admin write
# path stopped until its actual GAS source and Sheet write contract are supplied.
assert '**BLOCKED**' in audit
assert 'flow' in audit and 'page_content' in audit and 'return_tables' in audit
assert 'Sheet targets' in audit
assert 'avaAdminLaunch' not in runtime
assert 'appGrant' not in runtime
assert 'verifyAppGrant' not in runtime
print('Saving Admin write path remains safely blocked pending backend and Sheet contract')
