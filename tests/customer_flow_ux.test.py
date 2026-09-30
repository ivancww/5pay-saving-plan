from pathlib import Path

main = Path('src/main.js').read_text()
state = Path('src/state.js').read_text()
views = Path('src/views.js').read_text()
styles = Path('styles.css').read_text()
data = Path('src/data.js').read_text()

# Customer presentation no longer emits the old top/bottom provenance labels.
render_template = views.split('export function render', 1)[1].split('function p1', 1)[0]
assert 'front-topline' not in render_template
assert 'flow-footer' not in render_template

# P3 inputs update only the live result nodes; timeline cards update on tap.
assert "target.matches('[data-field], [data-assumption]')" in main
assert 'updateP3Live' in main
assert 'if (p3Editing) { updateP3Live(); return; }' in main
assert 'currentPath({ method' in views
assert 'function ageYearRail' in views
assert views.count('ageYearRail({') >= 4

# Age is carried in session state and translated from official policy years.
assert 'currentAge' in state
assert 'ageAtPolicyYear' in state
assert '目前歲數' in views and '完成供款時歲數' in views
assert 'ageYearRail' in views
assert 'id="customer-age" data-field="currentAge"' in views
assert "state.pageId === 'P3' && getCustomerAge(state) == null" in main
assert ".get('customerAge')" not in main and ".get('age')" not in main

# P6 uses the none/autosave official table; P7 uses only the five withdrawal strategies.
assert "supportedYears(official, 'none')" in views
for code, year in {
    'withdraw7_from8': 8,
    'withdraw12_from15': 15,
    'withdraw18_from20': 20,
    'withdraw23_from25': 25,
    'withdraw29_from30': 30,
}.items():
    assert f"['{code}', {year}]" in views
assert '自動滾存' in data
assert 'strategy-grid' not in views.split('function p7', 1)[1].split('function customerView', 1)[0]
assert '不提取' not in views

# Shared age/year rail provides first/middle/last touch/pointer points without page overflow.
assert 'timeline-rail' in views
assert 'touch-action:pan-x pan-y' in styles
assert 'min-width:0' in styles
assert 'flex:0 0 96px' in styles

print('customer flow UX regression contracts passed')
