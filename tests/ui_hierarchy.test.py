from pathlib import Path

index = Path('index.html').read_text()
main = Path('src/main.js').read_text()
views = Path('src/views.js').read_text()
styles = Path('styles.css').read_text()
build = Path('src/build.js').read_text()

assert 'AVA Saving' in index and 'id="app-version"' in index
assert 'id="return-ava"' in index
assert "document.querySelector('#customer-view-button')?.setAttribute('hidden', '')" in main
assert "document.querySelector('#reset-session')?.setAttribute('hidden', '')" in main
assert 'ava-button ava-button--secondary back-link' in views
assert 'ava-main-card' in views and 'flow-body' in views
assert '.ava-main-card' in styles and 'border:1px solid var(--control)' in styles
assert "export const APP_VERSION = 'V1.11';" in build
assert 'overflow-x:hidden' not in styles
assert '.phase-step{display:grid;grid-template-columns:34px minmax(0,1fr)' in styles
assert '.phase-step{grid-template-columns:30px minmax(0,1fr)}' in styles
assert 'overflow-wrap:anywhere' in styles

print('customer hierarchy and Frontstage header contracts passed')
