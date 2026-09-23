export function createState() {
  return { pageId: 'P1', history: [], session: { currentMethod: null, purpose: null, assumptions: {}, annualContribution: null, policyYear: 15, strategyCode: 'none' }, mode: 'use', customerView: false };
}

export function goTo(state, pageId) {
  if (state.pageId !== pageId) state.history.push(state.pageId);
  state.pageId = pageId; state.customerView = false;
}

export function goBack(state) { const previous = state.history.pop(); if (previous) state.pageId = previous; return previous; }
