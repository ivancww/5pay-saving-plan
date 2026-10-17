import { activeSavingPhases, calculateExistingResourceProjection, currentInstrumentSummary, currentPath, resolvePhaseWithdrawal, phaseStrategyChoices } from './calculation.js';
import { formatMoneyInputElement, normalizeMoneyValue, readInputValue } from './money.js';

export function createState({ currentAge = null } = {}) {
  return { pageId: 'START', history: [], session: { scenario: null, investmentTools: [], marketResponse: null, marketHistorySeries: 'hsi', marketPrincipal: 100000, marketStartYear: '2016', marketEndYear: '2025', maturityResponse: null, maturityHorizon: 5, mixedFocus: null, scenarioGoals: [], currentMethod: null, purpose: null, assumptions: {}, annualContribution: null, currentAge, ageError: false, policyYear: 15, strategyCode: 'none', withdrawalPolicyYear: null, withdrawalStrategyCode: null, savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }] }, mode: 'use', customerView: false };
}

export function normalizeMoneyState(session) {
  if (!session) return session;
  session.annualContribution = normalizeMoneyValue(session.annualContribution);
  session.assumptions ||= {};
  for (const key of ['existingDeposit', 'existingValue']) session.assumptions[key] = normalizeMoneyValue(session.assumptions[key]);
  for (const key of ['fixedDeposits', 'bonds']) {
    if (Array.isArray(session.assumptions[key])) {
      session.assumptions[key] = session.assumptions[key].map(item => ({ ...item, principal: normalizeMoneyValue(item?.principal) }));
    }
  }
  if (Array.isArray(session.savingPhases)) {
    session.savingPhases = session.savingPhases.map(phase => {
      const next = { ...phase };
      // A missing phase amount means inherit session.annualContribution.
      // An explicit null remains an explicit cleared override.
      if (Object.prototype.hasOwnProperty.call(phase || {}, 'annualContribution')) {
        next.annualContribution = normalizeMoneyValue(phase.annualContribution);
      } else {
        delete next.annualContribution;
      }
      return next;
    });
  }
  return session;
}

export function effectiveAnnualContribution(session = {}) {
  const phaseOne = Array.isArray(session.savingPhases)
    ? session.savingPhases.find(phase => phase?.id === 1)
    : null;
  if (phaseOne && Object.prototype.hasOwnProperty.call(phaseOne, 'annualContribution')) {
    return normalizeMoneyValue(phaseOne.annualContribution);
  }
  return normalizeMoneyValue(session.annualContribution);
}

// Shared input mutation for the live P3 path. Keeping field and assumption
// writes here ensures every input event reaches the same canonical session
// before a live calculation or render consumes it.
export function applySessionInput(session, target, value) {
  if (!session) return session;
  session.assumptions ||= {};
  if (target?.dataset?.field) session[target.dataset.field] = value;
  if (target?.dataset?.field === 'currentAge') session.ageError = false;
  if (target?.dataset?.assumption) {
    const key = {
      'customer-return-rate': 'returnRate',
      'current-rate': 'currentRate',
      'maturity-rate': 'maturityRate',
      'existing-value': 'existingValue',
      'existing-deposit': 'existingDeposit',
      'cash-rate': 'cashRate'
    }[target.dataset.assumption];
    if (key) session.assumptions[key] = value;
  }
  if (target?.dataset?.holdingField) {
    const method = target.dataset.holdingMethod;
    const index = Number(target.dataset.holdingIndex);
    if (method && Number.isInteger(index) && index >= 0) {
      const items = Array.isArray(session.assumptions[method])
        ? session.assumptions[method].map(item => ({ ...item }))
        : [];
      while (items.length <= index) items.push({ id: `${method}-${items.length + 1}`, principal: null, termYears: null, annualRate: null });
      items[index][target.dataset.holdingField] = value;
      session.assumptions[method] = items;
    }
  }
  normalizeMoneyState(session);
  return session;
}

// The P3 live card consumes the same normalized session that P4 uses. Keep
// this DOM update contract next to the canonical input mutation so a live
// input event cannot drift from the value used after navigation.
export function updateP3LiveDom(session, querySelector, projectionYears = 8) {
  normalizeMoneyState(session);
  const annualContribution = effectiveAnnualContribution(session);
  const instrument = currentInstrumentSummary({ method: session.currentMethod, assumptions: session.assumptions });
  const existingResource = calculateExistingResourceProjection({
    existingDeposit: session.assumptions?.existingDeposit,
    cashRate: session.assumptions?.cashRate,
    annualContribution,
    projectionYears
  });
  const path = instrument.available
    ? { kind: 'known', value: instrument.value, label: '今期到期金額按目前本金、年期及年息計算。' }
    : currentPath({ method: session.currentMethod, amount: annualContribution, assumptions: session.assumptions, projectionYears });
  const format = value => {
    const parsed = normalizeMoneyValue(value);
    return parsed == null ? '—' : `HK$ ${Math.round(parsed).toLocaleString('en-US')}`;
  };
  const annualValue = querySelector?.('#p3-annual-contribution-value');
  const pathValue = querySelector?.('#p3-current-path-value');
  const pathUnit = querySelector?.('#p3-current-path-unit');
  const pathStatus = querySelector?.('#p3-current-path-status');
  const instrumentPrincipal = querySelector?.('#p3-instrument-principal-value');
  const instrumentTerm = querySelector?.('#p3-instrument-term-value');
  const instrumentRate = querySelector?.('#p3-instrument-rate-value');
  const existingResourcePrincipal = querySelector?.('#p3-existing-resource-principal-value');
  const existingResourceAnnual = querySelector?.('#p3-existing-resource-annual-value');
  const existingResourceRate = querySelector?.('#p3-existing-resource-rate-value');
  const existingResourceValue = querySelector?.('#p3-existing-resource-value');
  if (annualValue) annualValue.textContent = format(annualContribution);
  if (pathValue) pathValue.textContent = path.value == null ? '—' : format(path.value);
  if (pathUnit) pathUnit.textContent = instrument.available ? '今期到期金額；到期後條件要到時再知道。' : path.kind === 'known' ? '按每年安排累積' : '按你輸入的假設';
  if (pathStatus) {
    pathStatus.className = `path-status path-status--${path.kind}`;
    pathStatus.textContent = path.label;
  }
  if (instrumentPrincipal) instrumentPrincipal.textContent = instrument.principal == null ? '—' : format(instrument.principal);
  if (instrumentTerm) instrumentTerm.textContent = instrument.termYears == null ? (instrument.details.length > 1 ? '各筆按輸入' : '—') : `${instrument.termYears}年`;
  if (instrumentRate) instrumentRate.textContent = instrument.annualRate == null ? (instrument.details.length > 1 ? '各筆按輸入' : '—') : `${(instrument.annualRate * 100).toLocaleString('zh-HK')}%`;
  if (existingResourcePrincipal) existingResourcePrincipal.textContent = existingResource.existingDeposit == null ? '—' : format(existingResource.existingDeposit);
  if (existingResourceAnnual) existingResourceAnnual.textContent = existingResource.annualContribution == null ? '—' : format(existingResource.annualContribution);
  if (existingResourceRate) existingResourceRate.textContent = session.assumptions?.cashRate == null || session.assumptions.cashRate === '' ? '未輸入' : `${session.assumptions.cashRate}%`;
  if (existingResourceValue) existingResourceValue.textContent = existingResource.available ? format(existingResource.value) : '—';
  return { annualContribution, path, existingResource };
}

// Production P3 input-event path. The browser listener and regression tests
// both enter here so formatting, parsing, canonical mutation and live DOM
// refresh cannot diverge.
export function handleP3InputEvent({ session, target, querySelector }) {
  if (target?.matches?.('[data-money-input]')) formatMoneyInputElement(target);
  const value = readInputValue(target);
  applySessionInput(session, target, value);
  return updateP3LiveDom(session, querySelector);
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
  if (phases.length < 3) phases.push({ id: phases.length + 1, annualContribution: session.annualContribution, strategyCode: null, withdrawalPolicyYear: null });
  session.savingPhases = phases.map(({ id, annualContribution, strategyCode, withdrawalPolicyYear }) => ({ id, annualContribution, strategyCode, withdrawalPolicyYear }));
}

export function removeSavingPhase(session, id) {
  if (id !== 2 && id !== 3) return;
  session.savingPhases = activeSavingPhases(session).filter(phase => phase.id < id)
    .map(({ id, annualContribution, strategyCode, withdrawalPolicyYear }) => ({ id, annualContribution, strategyCode, withdrawalPolicyYear }));
}

export function selectPhaseWithdrawal(session, phaseId, strategyCode, official) {
  const phases = activeSavingPhases(session);
  const phase = phases.find(item => item.id === phaseId);
  const point = phaseStrategyChoices(official).find(item => item.strategy_code === strategyCode);
  if (!phase || !point) return;
  phase.strategyCode = strategyCode;
  phase.withdrawalPolicyYear = point.policyYear;
  session.savingPhases = phases.map(({ id, annualContribution, strategyCode, withdrawalPolicyYear }) => ({ id, annualContribution, strategyCode, withdrawalPolicyYear }));
}

export function selectPhaseWithdrawalYear(session, phaseId, policyYear, official) {
  const phases = activeSavingPhases(session);
  const phase = phases.find(item => item.id === phaseId);
  const year = Number(policyYear);
  if (!phase || !resolvePhaseWithdrawal(phase, session, official).years.includes(year)) return;
  phase.withdrawalPolicyYear = year;
  session.savingPhases = phases.map(({ id, annualContribution, strategyCode, withdrawalPolicyYear }) => ({ id, annualContribution, strategyCode, withdrawalPolicyYear }));
}
