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


def fixed_contribution_projection(amount, rate, contribution_years, projection_years):
    projected = 0
    for year in range(projection_years):
        projected = (projected + (amount if year < contribution_years else 0)) * (1 + rate)
    return projected


def exact_cumulative(amount, rows, start_year, selected_year):
    return sum(
        amount * rate
        for year, rate in rows
        if start_year <= year <= selected_year
    )


# P3: each rate-based current method uses the same annual contribution timing
# convention; a rate of zero is a valid customer assumption.
assert abs(annual_projection(100000, 0.02, 5) - 530812.09632) < 1e-6
assert "const rateKey = { investment: 'returnRate', fixed_deposit: 'currentRate', bond: 'maturityRate' }[method];" in calculation
assert 'rawRate == null || rawRate ===' in calculation
assert '5年後現有方法預計有幾多' in views
assert '加入時間後會係點 →' in views
assert '並非官方 Saving 數據' not in views.split('function p3', 1)[1].split('function assumptionFields', 1)[0]
assert 'contributionYears = CONTRIBUTION_YEARS' in calculation
assert 'projectionYears = years' in calculation
assert abs(fixed_contribution_projection(100000, 0.02, 5, 5) - 530812.09632) < 1e-6
assert abs(fixed_contribution_projection(100000, 0.02, 5, 15) - (530812.09632 * (1.02 ** 10))) < 1e-6
assert fixed_contribution_projection(100000, 0.02, 5, 15) != annual_projection(100000, 0.02, 15)

# P4: one supported Saving year drives both sides, without interpolating.
assert 'projectionYears: selectedYear' in views
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
assert '.filter(item => {' in calculation
assert 'itemYear >= startYear && itemYear <= year' in calculation
assert 'reduce((sum, item)' in calculation
assert exact_cumulative(500000, [(8, 0.04), (9, 0.03), (10, 0.05)], 8, 10) == 60000
assert exact_cumulative(500000, [(8, 0.04), (10, 0.05)], 8, 10) == 45000
assert '不提取' not in views

# Touch/PWA layout contracts remain intact for both slider stages.
assert 'touch-action:pan-y' in styles
assert 'min-width:0' in styles

print('customer flow revision round 2 regression contracts passed')
