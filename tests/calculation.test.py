import importlib.util
from pathlib import Path

# Source-level contract checks for the browser adapter; the runtime suite is exercised in-browser.
source = Path('src/calculation.js').read_text()
assert 'Math.pow' not in source
assert 'interpolatedMultiplier' not in source
assert 'totalContribution = amount * CONTRIBUTION_YEARS' in source
assert 'rows.find(item => Number(item.policy_year) === year)' in source
print('calculation safety contract passed')
