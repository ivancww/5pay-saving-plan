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

# P3 and both time bars are input-driven and redraw immediately.
assert "target.matches('[data-field], [data-assumption], [data-year-slider], [data-withdrawal-slider]')" in main
assert 'draw(focus)' in main
assert 'currentPath({ method' in views
assert "dataAttribute: 'year-slider'" in views and "dataAttribute: 'withdrawal-slider'" in views

# Age is carried in session state and translated from official policy years.
assert 'currentAge' in state
assert 'ageAtPolicyYear' in state
assert '目前歲數' in views and '完成供款時歲數' in views
assert 'timelinePoint(state, year)' in views

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

# A native range input provides first/middle/last touch/pointer points without page overflow.
assert 'type="range"' in views
assert 'touch-action:pan-y' in styles
assert 'min-width:0' in styles

print('customer flow UX regression contracts passed')
