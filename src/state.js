import { activeSavingPhases, resolvePhaseWithdrawal, phaseStrategyChoices } from './calculation.js';

export function createState({ currentAge = null } = {}) {
  return { pageId: 'START', history: [], session: { scenario: null, investmentTools: [], marketResponse: null, maturityResponse: null, mixedFocus: null, scenarioGoals: [], currentMethod: null, purpose: null, assumptions: {}, annualContribution: null, currentAge, ageError: false, policyYear: 15, strategyCode: 'none', withdrawalPolicyYear: null, withdrawalStrategyCode: null, savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }] }, mode: 'use', customerView: false };
}

export function getCustomerAge(state) {
  const value = state?.session?.currentAge;
  if (value == null || value === '') return null;
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

// Customer-flow state only: never Official data or presentation overrides.
export function activateSavingPhase(session) {
  const phases = activeSavingPhases(session);
  if (phases.length < 3) phases.push({ id: phases.length + 1, strategyCode: null, withdrawalPolicyYear: null });
  session.savingPhases = phases.map(({ id, strategyCode, withdrawalPolicyYear }) => ({ id, strategyCode, withdrawalPolicyYear }));
}

export function removeSavingPhase(session, id) {
  if (id !== 2 && id !== 3) return;
  session.savingPhases = activeSavingPhases(session).filter(phase => phase.id < id)
    .map(({ id, strategyCode, withdrawalPolicyYear }) => ({ id, strategyCode, withdrawalPolicyYear }));
}

export function selectPhaseWithdrawal(session, phaseId, strategyCode, official) {
  const phases = activeSavingPhases(session);
  const phase = phases.find(item => item.id === phaseId);
  const point = phaseStrategyChoices(official).find(item => item.strategy_code === strategyCode);
  if (!phase || !point) return;
  phase.strategyCode = strategyCode;
  phase.withdrawalPolicyYear = point.policyYear;
  session.savingPhases = phases.map(({ id, strategyCode, withdrawalPolicyYear }) => ({ id, strategyCode, withdrawalPolicyYear }));
}

export function selectPhaseWithdrawalYear(session, phaseId, policyYear, official) {
  const phases = activeSavingPhases(session);
  const phase = phases.find(item => item.id === phaseId);
  const year = Number(policyYear);
  if (!phase || !resolvePhaseWithdrawal(phase, session, official).years.includes(year)) return;
  phase.withdrawalPolicyYear = year;
  session.savingPhases = phases.map(({ id, strategyCode, withdrawalPolicyYear }) => ({ id, strategyCode, withdrawalPolicyYear }));
}
