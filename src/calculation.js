import { normalizeMoneyValue } from './money.js';

export const CONTRIBUTION_YEARS = 5;

/**
 * Official-result adapter.
 * The endpoint supplies exact policy-year multipliers. The Phase 1 contract
 * defines the official base as total five-year contribution, then applies the
 * selected exact row's multiplier. No interpolation or projection is allowed.
 */
export function calculateOfficial({ annualContribution, policyYear, strategyCode = 'none', official }) {
  const amount = normalizeMoneyValue(annualContribution);
  const year = Number(policyYear);
  const configuredStrategy = official?.strategies?.find(item => item.strategy_code === strategyCode);
  const sheetName = official?.strategyMap?.[strategyCode] || configuredStrategy?.sheet_name || strategyCode;
  const rows = official?.return_tables?.[sheetName];
  if (!Number.isFinite(amount) || amount <= 0) return unavailable('請先輸入每年安排金額。');
  if (!rows?.length) return unavailable('暫時未有這個安排的官方資料。');
  const row = rows.find(item => Number(item.policy_year) === year);
  if (!row) return unavailable(`官方資料未提供第 ${year} 年，沒有估算或補值。`);
  const strategy = official.strategies?.find(item => item.strategy_code === strategyCode);
  const totalContribution = amount * CONTRIBUTION_YEARS;
  const rate = Number(row.withdrawal_rate) || Number(strategy?.withdraw_rate) || 0;
  const startYear = Number(strategy?.start_year) || null;
  const annualUsable = rate > 0 && startYear && year >= startYear ? totalContribution * rate : 0;
  const cumulativeUsed = calculateCumulativeWithdrawal({
    totalContribution, startYear, selectedYear: year, annualRate: Number(strategy?.withdraw_rate) || rate
  });
  const multiplier = Number(row.multiplier);
  if (!Number.isFinite(multiplier)) return unavailable('官方資料暫時無法展示。');
  const futureValue = totalContribution * multiplier;
  return {
    available: true, policyYear: year, multiplier, withdrawalRate: rate,
    totalContribution, futureValue, annualUsable,
    cumulativeUsed,
    // The Official multiplier is already the selected row's post-withdrawal
    // surrender/account value. Do not subtract cumulativeUsed again here.
    remainingValue: futureValue,
    strategyCode, sheetName, basis: 'total_contribution'
  };
}

// Official rows are account-value observation points, not annual withdrawal events.
// The configured strategy contract applies its annual rate for every year from
// the withdrawal start through the selected policy year, including sparse years.
export function calculateCumulativeWithdrawal({ totalContribution, startYear, selectedYear, annualRate }) {
  if (!Number.isFinite(totalContribution) || !startYear || selectedYear < startYear || annualRate <= 0) return 0;
  return totalContribution * annualRate * (selectedYear - startYear + 1);
}

function unavailable(message) { return { available: false, message }; }

export function supportedYears(official, strategyCode = 'none') {
  const sheet = official?.strategyMap?.[strategyCode] || strategyCode;
  return (official?.return_tables?.[sheet] || []).map(row => Number(row.policy_year)).filter(Number.isFinite);
}

function decimalRate(rawRate) {
  if (rawRate == null || rawRate === '') return null;
  const value = Number(rawRate);
  return Number.isFinite(value) ? value / 100 : null;
}

export function futureValueWithEndOfYearContributions({ annualContribution, annualRate = 0, projectionYears, contributionYears = CONTRIBUTION_YEARS, contributionStartYear = 1 }) {
  const amount = Number(annualContribution);
  const rate = Number(annualRate);
  const years = Math.max(0, Math.floor(Number(projectionYears)) || 0);
  const yearsWithContributions = Math.max(0, Math.floor(Number(contributionYears)) || 0);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate)) return 0;
  let value = 0;
  for (let year = 1; year <= years; year += 1) {
    value *= 1 + rate;
    if (year >= contributionStartYear && year <= yearsWithContributions) value += amount;
  }
  return value;
}

export function calculateBankValue({ principal = 0, annualRate = null, selectedYear = 0 }) {
  const amount = normalizeMoneyValue(principal);
  const years = Math.max(0, Math.floor(Number(selectedYear)) || 0);
  const rate = annualRate == null ? null : Number(annualRate);
  if (amount == null || amount < 0 || !Number.isFinite(years)) return 0;
  if (rate != null && !Number.isFinite(rate)) return amount;
  return rate == null ? amount : amount * (1 + rate) ** years;
}

export function calculateFixedDepositValue({ principal, termYears, annualRate, selectedYear }) {
  const amount = normalizeMoneyValue(principal);
  const rawTerm = Number(termYears);
  const term = Number.isFinite(rawTerm) && rawTerm >= 0 ? rawTerm : 0;
  const years = Math.max(0, Number(selectedYear));
  const rawRate = Number(annualRate);
  const rate = Number.isFinite(rawRate) ? rawRate : 0;
  if (amount == null || amount < 0 || !Number.isFinite(years)) return 0;
  return amount * (1 + rate) ** Math.min(years, term);
}

export function calculateBondValue({ principal, termYears, annualRate, selectedYear }) {
  const amount = normalizeMoneyValue(principal);
  const rawTerm = Number(termYears);
  const term = Number.isFinite(rawTerm) && rawTerm >= 0 ? rawTerm : 0;
  const years = Math.max(0, Number(selectedYear));
  const rawRate = Number(annualRate);
  const rate = Number.isFinite(rawRate) ? rawRate : 0;
  if (amount == null || amount < 0 || !Number.isFinite(years)) return 0;
  return amount * (1 + rate * Math.min(years, term));
}

function normalizedHoldings(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: item?.id || `holding-${index + 1}`,
    principal: Number(item?.principal),
    termYears: Number(item?.termYears),
    annualRate: decimalRate(item?.annualRate)
  })).filter(item => Number.isFinite(item.principal) && item.principal >= 0 && Number.isFinite(item.termYears) && item.termYears >= 0 && Number.isFinite(item.annualRate));
}

/**
 * The current instrument page is deliberately limited to the known term.
 * It must not turn today's rate into an assumed post-maturity reinvestment.
 */
export function currentInstrumentSummary({ method, assumptions = {} }) {
  const key = method === 'fixed_deposit' ? 'fixedDeposits' : method === 'bond' ? 'bonds' : null;
  if (!key) return { available: false, details: [], value: null };
  const holdings = normalizedHoldings(assumptions[key]);
  const calculate = method === 'fixed_deposit' ? calculateFixedDepositValue : calculateBondValue;
  const details = holdings.map(item => ({
    ...item,
    value: calculate({ ...item, selectedYear: item.termYears }),
    matured: false
  }));
  const value = details.length ? details.reduce((sum, item) => sum + item.value, 0) : null;
  return {
    available: value != null && Number.isFinite(value),
    details,
    value: Number.isFinite(value) ? value : null,
    principal: details.length ? details.reduce((sum, item) => sum + item.principal, 0) : null,
    termYears: details.length === 1 ? details[0].termYears : null,
    annualRate: details.length === 1 ? details[0].annualRate : null
  };
}

export function calculateBankProjection({ existingDeposit = 0, cashRate = null, annualContribution = 0, projectionYears = 0 }) {
  const rate = decimalRate(cashRate);
  const existingDepositFutureValue = calculateBankValue({ principal: existingDeposit, annualRate: rate, selectedYear: projectionYears });
  // Bank/Cash receives the annual arrangement for every selected year. The
  // five-year limit belongs only to the compound-saving account component.
  const futureAnnualValue = futureValueWithEndOfYearContributions({ annualContribution, annualRate: rate ?? 0, projectionYears, contributionYears: projectionYears });
  return {
    value: existingDepositFutureValue + futureAnnualValue,
    existingDepositFutureValue, futureAnnualValue, rate,
    rateKnown: rate != null,
    label: rate == null ? '未加入利息假設；按現有本金及每年安排展示。' : '按你輸入的銀行年息計算。'
  };
}

/**
 * Resource A for the FD/Bond conversation: existing deposit plus the annual
 * amount that remains in cash. It deliberately uses the Bank/Cash timing
 * contract and never reads the current instrument's rate.
 */
export function calculateExistingResourceProjection({ existingDeposit = null, cashRate = null, annualContribution = null, projectionYears = 8 }) {
  const existing = normalizeMoneyValue(existingDeposit);
  const annual = normalizeMoneyValue(annualContribution);
  const year = Math.max(0, Math.floor(Number(projectionYears)) || 0);
  if (existing == null && annual == null) return { available: false, projectionYears: year, value: null, growth: null, rate: decimalRate(cashRate) };
  const bank = calculateBankProjection({
    existingDeposit: existing ?? 0,
    cashRate,
    annualContribution: annual ?? 0,
    projectionYears: year
  });
  const principal = (existing ?? 0) + (annual ?? 0) * year;
  return {
    ...bank,
    available: true,
    projectionYears: year,
    existingDeposit: existing,
    annualContribution: annual,
    principal,
    growth: bank.value - principal
  };
}

function bankDepositsAfterSaving({ annualContribution, annualRate, projectionYears, savingYears = CONTRIBUTION_YEARS }) {
  return futureValueWithEndOfYearContributions({
    annualContribution,
    annualRate,
    projectionYears,
    contributionYears: projectionYears,
    contributionStartYear: savingYears + 1
  });
}

/**
 * Fair Scenario 1 comparison: both sides contribute the same principal.
 * Bank receives every annual arrangement; the compound-saving side sends the
 * first five to the Official account and the remainder back to Bank/Cash.
 */
export function calculateFairPrincipalComparison({ existingDeposit = null, cashRate = null, annualContribution, projectionYears, official }) {
  const amount = normalizeMoneyValue(annualContribution);
  const year = Math.max(0, Math.floor(Number(projectionYears)) || 0);
  if (amount == null || amount <= 0 || !Number.isFinite(year) || year <= 0) return { available: false, policyYear: year };

  const existing = normalizeMoneyValue(existingDeposit);
  const existingPrincipal = existing ?? 0;
  const rate = decimalRate(cashRate);
  const bank = calculateBankProjection({ existingDeposit: existingPrincipal, cashRate, annualContribution: amount, projectionYears: year });
  const bankAnnualPrincipal = amount * year;
  const bankPrincipal = existingPrincipal + bankAnnualPrincipal;

  const savingContributionPrincipal = amount * Math.min(CONTRIBUTION_YEARS, year);
  const postSavingYears = Math.max(0, year - CONTRIBUTION_YEARS);
  const savingBankPrincipal = existingPrincipal + amount * postSavingYears;
  const savingBankValue = calculateBankValue({ principal: existingPrincipal, annualRate: rate, selectedYear: year })
    + bankDepositsAfterSaving({ annualContribution: amount, annualRate: rate ?? 0, projectionYears: year });
  const officialResult = calculateOfficial({ annualContribution: amount, policyYear: year, strategyCode: 'none', official });
  const savingPlanValue = officialResult.available ? officialResult.futureValue : null;
  const savingTotal = savingPlanValue == null ? null : savingBankValue + savingPlanValue;
  const savingPrincipal = savingBankPrincipal + savingContributionPrincipal;

  return {
    available: savingTotal != null,
    policyYear: year,
    annualContribution: amount,
    existingPrincipal,
    bankExistingPrincipal: existingPrincipal,
    bankAnnualPrincipal,
    bankPrincipal,
    bankTotal: bank.value,
    bankGrowth: bank.value - bankPrincipal,
    savingContributionPrincipal,
    savingBankPrincipal,
    savingBankValue,
    savingPlanValue,
    savingPrincipal,
    savingTotal,
    savingGrowth: savingTotal == null ? null : savingTotal - savingPrincipal,
    official: officialResult,
    bank
  };
}

function legacyCurrentPath({ method, amount, assumptions, projectionYears, contributionYears }) {
  const rateKey = { investment: 'returnRate', fixed_deposit: 'currentRate', bond: 'maturityRate' }[method];
  if (rateKey) {
    const rawRate = assumptions[rateKey];
    const rate = decimalRate(rawRate);
    if (rate == null) return { kind: 'unknown', label: '請輸入年回報／利率，先睇到較完整的預計數字。' };
    return { kind: 'assumption', value: futureValueWithEndOfYearContributions({ annualContribution: amount, annualRate: rate, projectionYears, contributionYears }), label: `按你輸入的 ${rawRate}% 假設計算。` };
  }
  if (method === 'long_term' && !assumptions.existingValue) return { kind: 'unknown', label: '等客戶提供現有安排資料後再展示。' };
  const existingValue = normalizeMoneyValue(assumptions.existingValue);
  return { kind: 'assumption', value: existingValue ?? amount, label: '按你提供的現有安排資料展示。' };
}

export function currentPath({ method, amount, assumptions = {}, years = CONTRIBUTION_YEARS, contributionYears = CONTRIBUTION_YEARS, projectionYears = years }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return { kind: 'unknown', label: '輸入同一筆錢後，可以睇得更具體。' };
  const projection = Math.max(0, Math.floor(Number(projectionYears)) || 0);
  if (method === 'cash' || method === 'none') {
    const bank = calculateBankProjection({ existingDeposit: normalizeMoneyValue(assumptions.existingDeposit) ?? 0, cashRate: assumptions.cashRate, annualContribution: value, projectionYears: projection });
    return { kind: 'known', value: bank.value, label: bank.label, method, breakdown: bank };
  }
  if (method === 'fixed_deposit' || method === 'bond') {
    const key = method === 'fixed_deposit' ? 'fixedDeposits' : 'bonds';
    const holdings = normalizedHoldings(assumptions[key]);
    if (holdings.length) {
      const details = holdings.map(item => ({ ...item, value: method === 'fixed_deposit' ? calculateFixedDepositValue({ ...item, selectedYear: projection }) : calculateBondValue({ ...item, selectedYear: projection }), matured: projection > item.termYears }));
      const total = details.reduce((sum, item) => sum + item.value, 0);
      return { kind: 'assumption', value: total, method, details, label: method === 'fixed_deposit' ? '按每筆現有定期本金、年期及年息計算。' : '按每筆現有債券本金、距離到期及年息計算。' };
    }
  }
  return legacyCurrentPath({ method, amount: value, assumptions, projectionYears: projection, contributionYears });
}

// Independent copies of the same verified five-year arrangement, never new products.
export const SAVING_PHASES = Object.freeze([
  Object.freeze({ id: 1, label: '第一期', offset: 0 }),
  Object.freeze({ id: 2, label: '第二期', offset: 5 }),
  Object.freeze({ id: 3, label: '第三期', offset: 10 })
]);
export const WITHDRAWAL_STARTS = Object.freeze([
  ['withdraw7_from8', 8], ['withdraw12_from15', 15], ['withdraw18_from20', 20],
  ['withdraw23_from25', 25], ['withdraw29_from30', 30]
]);

export function activeSavingPhases(session = {}) {
  const stored = Array.isArray(session.savingPhases) ? session.savingPhases : [];
  let count = 1;
  while (count < 3 && stored.some(phase => phase?.id === count + 1)) count++;
  const fallback = Number(session.annualContribution);
  return SAVING_PHASES.slice(0, count).map(phase => {
    const saved = stored.find(item => item?.id === phase.id);
    const rawAmount = saved && Object.prototype.hasOwnProperty.call(saved, 'annualContribution') ? saved.annualContribution : fallback;
    const annualContribution = Number.isFinite(Number(rawAmount)) && Number(rawAmount) > 0 ? Number(rawAmount) : null;
    return { ...phase, annualContribution,
      strategyCode: saved ? saved.strategyCode || null : (phase.id === 1 ? session.withdrawalStrategyCode || (session.strategyCode !== 'none' ? session.strategyCode : null) : null) || null,
      withdrawalPolicyYear: saved && Object.prototype.hasOwnProperty.call(saved, 'withdrawalPolicyYear') ? saved.withdrawalPolicyYear : (phase.id === 1 ? session.withdrawalPolicyYear ?? null : null)
    };
  });
}

export function withdrawalPoints(official) {
  return WITHDRAWAL_STARTS.map(([strategyCode, policyYear]) => {
    const strategy = official?.strategies?.find(item => item.strategy_code === strategyCode && Number(item.start_year) === policyYear);
    return strategy ? { ...strategy, policyYear } : null;
  }).filter(Boolean);
}

// Auto accumulation is a canonical Official table choice, not a withdrawal strategy.
export function phaseStrategyChoices(official) {
  const years = supportedYears(official, 'none');
  return [{ strategy_code: 'none', policyYear: years[0] ?? null, display_name: '自動滾存' }, ...withdrawalPoints(official)];
}

// Accumulation is a progressive total of exact, currently known phase values.
export function calculateSavingPortfolio({ session, overallPolicyYear, official }) {
  const year = Number(overallPolicyYear);
  const phases = activeSavingPhases(session).map(phase => {
    const localPolicyYear = year - phase.offset;
    if (localPolicyYear <= 0) return { ...phase, localPolicyYear, started: false, available: false };
    const result = calculateOfficial({ annualContribution: phase.annualContribution, policyYear: localPolicyYear, strategyCode: 'none', official });
    return { ...phase, ...result, localPolicyYear, started: true };
  });
  const validInput = Number.isInteger(year) && year > 0 && phases.every(phase => !phase.started || Number.isFinite(phase.annualContribution));
  const known = phases.filter(phase => phase.started && phase.available);
  const plannedContribution = validInput ? phases.reduce((sum, phase) => sum + Number(phase.annualContribution || 0) * CONTRIBUTION_YEARS, 0) : undefined;
  const totalContribution = validInput ? phases.reduce((sum, phase) => sum + (phase.started ? Number(phase.annualContribution || 0) * Math.min(CONTRIBUTION_YEARS, Math.max(0, phase.localPolicyYear)) : 0), 0) : undefined;
  const base = { policyYear: year, phases, availablePhaseCount: known.length,
    unavailablePhaseCount: phases.filter(phase => phase.started && !phase.available).length,
    complete: validInput && phases.every(phase => !phase.started || phase.available),
    totalContribution, plannedContribution };
  if (!validInput || !known.length) return { ...base, available: false, message: '這個時間點暫未有可顯示價值。' };
  const value = known.reduce((sum, phase) => sum + phase.remainingValue, 0);
  return { ...base, available: true, futureValue: value, remainingValue: value };
}

// Each withdrawal scenario has its own exact local time, independently of accumulation.
export function resolvePhaseWithdrawal(phase, session, official) {
  const points = withdrawalPoints(official);
  const strategy = points.find(item => item.strategy_code === phase.strategyCode) || points[0];
  const autoAccumulation = phase.strategyCode === 'none';
  const strategyCode = autoAccumulation ? 'none' : strategy?.strategy_code;
  const startYear = autoAccumulation ? null : strategy?.policyYear;
  const years = autoAccumulation ? supportedYears(official, 'none') : strategy ? supportedYears(official, strategyCode).filter(year => year >= startYear) : [];
  const selectedYear = phase.withdrawalPolicyYear == null ? years[0] : Number(phase.withdrawalPolicyYear);
  const result = years.includes(selectedYear) ? calculateOfficial({ annualContribution: phase.annualContribution ?? session.annualContribution, policyYear: selectedYear, strategyCode, official }) : { available: false, message: '這一期暫未有可顯示結果。' };
  return { ...phase, strategyCode, autoAccumulation, startYear, years, selectedYear, localPolicyYear: selectedYear,
    overallPolicyYear: phase.offset + selectedYear, result: result.available ? result : { ...result, message: '這一期暫未有可顯示結果。' } };
}

export function aggregateWithdrawalResults(phases, annualContribution) {
  const totalContribution = phases.length ? phases.reduce((sum, phase) => sum + Number(phase.result?.totalContribution ?? (Number(phase.annualContribution || annualContribution) * CONTRIBUTION_YEARS)), 0) : undefined;
  if (!phases.length || phases.some(phase => !phase.result.available)) {
    return { available: false, totalContribution, message: '部分期數暫未有可顯示結果，合計稍後再看。' };
  }
  const sum = key => phases.reduce((total, phase) => total + phase.result[key], 0);
  return { available: true, annualUsable: sum('annualUsable'), cumulativeUsed: sum('cumulativeUsed'),
    remainingValue: sum('remainingValue'), futureValue: sum('futureValue'), totalContribution };
}

// P7 and Customer View share the exact same independent selections and summary.
export function withdrawalPortfolio(session, official) {
  const phases = activeSavingPhases(session).map(phase => resolvePhaseWithdrawal(phase, session, official));
  return { phases, result: aggregateWithdrawalResults(phases, session.annualContribution) };
}
