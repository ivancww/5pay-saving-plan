export const CONTRIBUTION_YEARS = 5;

/**
 * Official-result adapter.
 * The endpoint supplies exact policy-year multipliers. The Phase 1 contract
 * defines the official base as total five-year contribution, then applies the
 * selected exact row's multiplier. No interpolation or projection is allowed.
 */
export function calculateOfficial({ annualContribution, policyYear, strategyCode = 'none', official }) {
  const amount = Number(annualContribution);
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
  const cumulativeUsed = rows
    .filter(item => {
      const itemYear = Number(item.policy_year);
      return Number.isFinite(itemYear) && startYear && itemYear >= startYear && itemYear <= year;
    })
    .reduce((sum, item) => {
      const itemRate = Number(item.withdrawal_rate) || Number(strategy?.withdraw_rate) || 0;
      return sum + (itemRate > 0 ? totalContribution * itemRate : 0);
    }, 0);
  const futureValue = totalContribution * Number(row.multiplier);
  return {
    available: true, policyYear: year, multiplier: Number(row.multiplier), withdrawalRate: rate,
    totalContribution, futureValue, annualUsable,
    cumulativeUsed,
    // The Official multiplier is already the selected row's post-withdrawal
    // surrender/account value. Do not subtract cumulativeUsed again here.
    remainingValue: futureValue,
    strategyCode, sheetName, basis: 'total_contribution'
  };
}

function unavailable(message) { return { available: false, message }; }

export function supportedYears(official, strategyCode = 'none') {
  const sheet = official?.strategyMap?.[strategyCode] || strategyCode;
  return (official?.return_tables?.[sheet] || []).map(row => Number(row.policy_year)).filter(Number.isFinite);
}

export function currentPath({ method, amount, assumptions = {}, years = CONTRIBUTION_YEARS, contributionYears = CONTRIBUTION_YEARS, projectionYears = years }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return { kind: 'unknown', label: '輸入同一筆錢後，可以睇得更具體。' };
  const contributions = Math.max(0, Math.floor(Number(contributionYears)) || 0);
  const projection = Math.max(0, Math.floor(Number(projectionYears)) || 0);
  if (method === 'cash' || method === 'none') return { kind: 'known', value: value * Math.min(contributions, projection), label: '按每年安排金額累積，未加入利息假設。' };
  const rateKey = { investment: 'returnRate', fixed_deposit: 'currentRate', bond: 'maturityRate' }[method];
  if (rateKey) {
    const rawRate = assumptions[rateKey];
    if (rawRate == null || rawRate === '') return { kind: 'unknown', label: '請輸入年回報／利率，先睇到較完整的預計數字。' };
    const rate = Number(rawRate) / 100;
    if (!Number.isFinite(rate) || rate < -1) return { kind: 'unknown', label: '呢個假設未能讀取，未作推算。' };
    let projected = 0;
    for (let year = 0; year < projection; year += 1) {
      projected = (projected + (year < contributions ? value : 0)) * (1 + rate);
    }
    return { kind: 'assumption', value: projected, label: `按你輸入的 ${rawRate}% 假設計算。` };
  }
  if (method === 'long_term' && !assumptions.existingValue) return { kind: 'unknown', label: '等客戶提供現有安排資料後再展示。' };
  return { kind: 'assumption', value: Number(assumptions.existingValue || value), label: '按你提供的現有安排資料展示。' };
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
  return SAVING_PHASES.slice(0, count).map(phase => ({ ...phase,
    strategyCode: stored.find(item => item?.id === phase.id)?.strategyCode
      || (phase.id === 1 ? session.withdrawalStrategyCode || (session.strategyCode !== 'none' ? session.strategyCode : null) : null)
      || null
  }));
}

export function withdrawalPoints(official) {
  return WITHDRAWAL_STARTS.map(([strategyCode, policyYear]) => {
    const strategy = official?.strategies?.find(item => item.strategy_code === strategyCode && Number(item.start_year) === policyYear);
    return strategy ? { ...strategy, policyYear } : null;
  }).filter(Boolean);
}

export function resolvedSavingPhases(session, official, mode = 'accumulation') {
  const points = withdrawalPoints(official);
  return activeSavingPhases(session).map(phase => {
    const strategy = mode === 'withdrawal' ? points.find(item => item.strategy_code === phase.strategyCode) || points[0] : null;
    return { ...phase, strategyCode: mode === 'withdrawal' ? strategy?.strategy_code : 'none', startYear: strategy?.policyYear };
  });
}

export function calculateSavingPortfolio({ session, overallPolicyYear, official, mode = 'accumulation' }) {
  const year = Number(overallPolicyYear);
  const amount = Number(session.annualContribution);
  const phases = resolvedSavingPhases(session, official, mode).map(phase => {
    const localPolicyYear = year - phase.offset;
    if (localPolicyYear <= 0) return { ...phase, localPolicyYear, started: false, available: true };
    const result = mode === 'withdrawal' && !phase.strategyCode ? { available: false } : calculateOfficial({
      annualContribution: session.annualContribution, policyYear: localPolicyYear, strategyCode: phase.strategyCode, official
    });
    return { ...phase, ...result, localPolicyYear, started: true };
  });
  const validInput = Number.isInteger(year) && year > 0 && Number.isFinite(amount) && amount > 0;
  const totalContribution = validInput ? amount * phases.reduce((sum, phase) => sum + Math.min(5, Math.max(0, phase.localPolicyYear)), 0) : undefined;
  const base = { policyYear: year, phases, totalContribution,
    plannedContribution: Number.isFinite(amount) && amount > 0 ? amount * 5 * phases.length : undefined };
  if (!validInput || phases.some(phase => phase.started && !phase.available)) {
    return { ...base, available: false, message: '這個時間點暫未有完整資料，請探索其他時間點。' };
  }
  const started = phases.filter(phase => phase.started);
  const sum = key => started.reduce((total, phase) => total + phase[key], 0);
  return { ...base, available: true, futureValue: sum('futureValue'), remainingValue: sum('remainingValue'),
    annualUsable: sum('annualUsable'), cumulativeUsed: sum('cumulativeUsed') };
}

// P7 and Customer View resolve the same default strategies, year and combined result.
export function withdrawalPortfolio(session, official) {
  const phases = resolvedSavingPhases(session, official, 'withdrawal');
  const starts = phases.map(phase => phase.offset + phase.startYear).filter(Number.isFinite);
  const firstStart = starts.length ? Math.min(...starts) : undefined;
  const years = [...new Set(phases.flatMap(phase => supportedYears(official, phase.strategyCode)
    .map(year => year + phase.offset)))].filter(year => year >= firstStart).sort((a, b) => a - b);
  const requested = session.withdrawalOverallYear ?? session.withdrawalPolicyYear;
  const selectedYear = requested != null && years.includes(Number(requested)) ? Number(requested) : years[0];
  return { phases, years, selectedYear, result: calculateSavingPortfolio({ session, overallPolicyYear: selectedYear, official, mode: 'withdrawal' }) };
}
