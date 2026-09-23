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
  const sheetName = official?.strategyMap?.[strategyCode] || strategyCode;
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
  const cumulativeUsed = annualUsable && startYear ? annualUsable * (year - startYear + 1) : 0;
  return {
    available: true, policyYear: year, multiplier: Number(row.multiplier), withdrawalRate: rate,
    totalContribution, futureValue: totalContribution * Number(row.multiplier), annualUsable,
    cumulativeUsed, remainingValue: totalContribution * Number(row.multiplier),
    strategyCode, sheetName, basis: 'total_contribution'
  };
}

function unavailable(message) { return { available: false, message }; }

export function supportedYears(official, strategyCode = 'none') {
  const sheet = official?.strategyMap?.[strategyCode] || strategyCode;
  return (official?.return_tables?.[sheet] || []).map(row => Number(row.policy_year)).filter(Number.isFinite);
}

export function currentPath({ method, amount, assumptions = {} }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return { kind: 'unknown', label: '輸入同一筆錢後，可以睇得更具體。' };
  if (method === 'cash' || method === 'none') return { kind: 'known', value, label: '以本金路徑展示；沒有加入銀行利息假設。' };
  if (method === 'investment' && !assumptions.returnRate) return { kind: 'unknown', label: '未有客戶假設，未來市場價值保持「$ ?」。' };
  if (method === 'fixed_deposit' && !assumptions.currentRate) return { kind: 'unknown', label: '今期以外的續期利率未知道，未作推算。' };
  if (method === 'bond' && !assumptions.maturityRate) return { kind: 'unknown', label: '到期後的再安排未知道，未作推算。' };
  if (method === 'long_term' && !assumptions.existingValue) return { kind: 'unknown', label: '等客戶提供現有安排資料後再展示。' };
  return { kind: 'assumption', value, label: '按客戶提供的假設展示，並非官方 Saving 數據。' };
}
