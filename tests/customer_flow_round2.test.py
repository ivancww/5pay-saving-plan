from pathlib import Path

calculation = Path('src/calculation.js').read_text()
views = Path('src/views.js').read_text()
main = Path('src/main.js').read_text()
styles = Path('styles.css').read_text()


def annual_projection(amount, rate, years):
    projected = 0
    for _ in range(years):
        projected = (projected + amount) * (1 + rate)
    return projected


# P3: each rate-based current method uses the same annual contribution timing
# convention; a rate of zero is a valid customer assumption.
assert abs(annual_projection(100000, 0.02, 5) - 530812.09632) < 1e-6
assert "const rateKey = { investment: 'returnRate', fixed_deposit: 'currentRate', bond: 'maturityRate' }[method];" in calculation
assert 'rawRate == null || rawRate ===' in calculation
assert '5年後現有方法預計有幾多' in views
assert '加入時間後會係點 →' in views
assert '並非官方 Saving 數據' not in views.split('function p3', 1)[1].split('function assumptionFields', 1)[0]

# P4: one supported Saving year drives both sides, without interpolating.
assert 'years: selectedYear' in views
assert "supportedYears(official, 'none')" in views
assert "rows.find(item => Number(item.policy_year) === year)" in calculation
assert 'interpolatedMultiplier' not in calculation
assert 'comparison-time-slider' in views
assert '同一筆每年安排' in views and '同一段時間' in views
assert "['P3', 'P4', 'P6', 'P7']" in main

# P6: the customer-facing labels are ages only while the slider still stores
# and looks up exact policy years.
assert 'function timelinePoint(state, year)' in views
assert '第 ${year}' not in views
assert "dataAttribute: 'year-slider'" in views

# P7: stage A is limited to the five supported starts; stage B follows only
# the selected strategy's exact rows and resets to its first eligible point.
for code, year in {
    'withdraw7_from8': 8,
    'withdraw12_from15': 15,
    'withdraw18_from20': 20,
    'withdraw23_from25': 25,
    'withdraw29_from30': 30,
}.items():
    assert f"['{code}', {year}]" in views
assert "supportedYears(official, selected.strategy_code).filter(year => year >= startYear)" in views
assert "dataAttribute: 'withdrawal-point-slider'" in views
assert 'data-withdrawal-point-slider' in main
assert 'state.session.withdrawalPolicyYear = selected.policyYear' in main
assert 'state.session.withdrawalPolicyYear = selectedYear' in main
assert 'remainingValue: futureValue' in calculation
assert 'cumulativeUsed' in views
assert '不提取' not in views

# Touch/PWA layout contracts remain intact for both slider stages.
assert 'touch-action:pan-y' in styles
assert 'min-width:0' in styles

print('customer flow revision round 2 regression contracts passed')
