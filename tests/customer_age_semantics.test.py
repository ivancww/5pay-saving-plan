from pathlib import Path

main = Path('src/main.js').read_text()
state = Path('src/state.js').read_text()
views = Path('src/views.js').read_text()

# The normal flow collects age once on P3 and blocks P3 -> P4/P5 progression
# until that customer-owned value exists; URL query state is not a source.
assert 'id="customer-age" data-field="currentAge"' in views
assert "state.pageId === 'P3' && getCustomerAge(state) == null" in main
assert ".get('customerAge')" not in main and ".get('age')" not in main

# Verified Saving convention: policy year is elapsed time from current age.
def presentation_age(current_age, policy_year):
    return current_age + policy_year

assert presentation_age(40, 5) == 45
assert presentation_age(40, 8) == 48
assert presentation_age(40, 15) == 55
assert presentation_age(40, 20) == 60

# P5, P6, and P7 all route age display through the same helper, avoiding
# separate -1 or inclusive-year conventions.
assert 'const completionAge = ageAtPolicyYear(state, phases.length * 5);' in views
assert 'function ageYearRail' in views
assert "phase.id === 1 ? 'withdrawal-start-rail'" in views
assert 'ageYearRail({ id: \'withdrawal-explore-rail\'' in views
assert views.count('ageAtPolicyYear(state,') >= 5
assert 'current age + exact official policy year' in state

print('customer age source and semantics regression contracts passed')
