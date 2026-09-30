export function createState({ currentAge = null } = {}) {
  return { pageId: 'P1', history: [], session: { currentMethod: null, purpose: null, assumptions: {}, annualContribution: null, currentAge, ageError: false, policyYear: 15, strategyCode: 'none', withdrawalPolicyYear: null, withdrawalStrategyCode: null }, mode: 'use', customerView: false };
}

export function getCustomerAge(state) {
  const value = state?.session?.currentAge;
  const age = Number(value);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

// Saving's policy year is elapsed time from the customer's current-age baseline.
// Therefore the presentation age is current age + exact official policy year;
// there is no inclusive-year -1 adjustment.
export function ageAtPolicyYear(state, policyYear) {
  const age = getCustomerAge(state);
  const year = Number(policyYear);
  return age == null || !Number.isFinite(year) ? null : age + year;
}

export function goTo(state, pageId) {
  if (state.pageId !== pageId) state.history.push(state.pageId);
  state.pageId = pageId; state.customerView = false;
}

export function goBack(state) { const previous = state.history.pop(); if (previous) state.pageId = previous; return previous; }
