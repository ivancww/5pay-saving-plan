// App-owned flow defaults use the same page IDs and routing domain as Saving_Flow
// and Saving_Routing. Official rows may supply presentation metadata or routes;
// customer selections and conceptual illustrations never become Official data.
export const SCENARIO_FLOW = Object.freeze([
  { page_id: 'START', order: 0, page_type: 'scenario', title: '而家想由邊度開始？', subtitle: '揀一個最接近你而家情況的選項。', enabled: true },
  { page_id: 'S2_TOOLS', order: 1.02, page_type: 'scenario', title: '你而家用緊邊啲工具？', subtitle: '可以揀多過一項。', enabled: true },
  { page_id: 'S2_MARKET', order: 1.03, page_type: 'scenario', title: '如果市場突然出現較大波動，你會點處理呢筆錢？', subtitle: '呢條線只係概念例子，唔係預測或歷史數據。', enabled: true },
  { page_id: 'S2_MATURITY', order: 1.04, page_type: 'scenario', title: '到期之後，你下一步會點？', subtitle: '短中期安排到期時，往往會再出現決定點。', enabled: true },
  { page_id: 'S2_MIXED', order: 1.05, page_type: 'scenario', title: '兩種考慮可以同時存在', subtitle: '市場波動同到期決定，都值得預先諗一諗。', enabled: true },
  { page_id: 'S3_GOALS', order: 1.06, page_type: 'scenario', title: '你希望呢筆錢有咩特點？', subtitle: '揀一項、兩項或者三項。', enabled: true },
  { page_id: 'S3_TRADEOFF', order: 1.07, page_type: 'scenario', title: '一件工具未必負責晒所有角色', subtitle: '以下係概念性取捨，唔係產品評分或回報承諾。', enabled: true }
]);

export const INVESTMENT_TOOLS = Object.freeze([
  ['fixed_deposit', '定期存款', '到期後可再決定下一步。'],
  ['stock', '股票', '價值會跟市場變動。'],
  ['etf', 'ETF', '仍然會受市場波動影響。'],
  ['bond', '債券', '留意到期及發行方／市場風險。']
]);
export const SCENARIO_GOALS = Object.freeze([
  ['stability', '穩定／安心'], ['flexibility', '靈活性'], ['growth', '增長潛力']
]);

export const SCENARIO_CONTENT = Object.freeze([
  ['START', 'entry-no-arrangement', 'scenario1', '我而家未有特別安排', '或者仲未認真諗住點樣建立儲蓄。'],
  ['START', 'entry-existing-tools', 'scenario2', '我已經有投資／儲蓄工具', '想了解現有安排可以點樣分工。'],
  ['START', 'entry-looking', 'scenario3', '我正搵緊合適的儲蓄工具', '想先整理自己重視的特點。'],
  ...INVESTMENT_TOOLS.map(([key, label, note]) => ['S2_TOOLS', `tool-${key}`, key, label, note])
].map(([page_id, content_id, action_key, headline, subtext], index) => ({
  page_id, content_id, action_key, headline, subtext,
  content_type: 'choice', order: index + 1, enabled: true
})));

export function toggleChoice(selected, key, allowed) {
  if (!allowed.some(item => item[0] === key)) return selected;
  return selected.includes(key) ? selected.filter(item => item !== key) : [...selected, key];
}

export function investmentPath(selected) {
  const market = selected.some(key => key === 'stock' || key === 'etf');
  const maturity = selected.some(key => key === 'fixed_deposit' || key === 'bond');
  return market && maturity ? 'S2_MIXED' : market ? 'S2_MARKET' : maturity ? 'S2_MATURITY' : null;
}

const NEXT = Object.freeze({
  scenario1: 'P1', scenario2: 'S2_TOOLS', scenario3: 'S3_GOALS',
  scenario2_market: 'S2_MARKET', scenario2_maturity: 'S2_MATURITY', scenario2_mixed: 'S2_MIXED',
  scenario3_goals: 'S3_TRADEOFF', scenario_to_saving: 'P2'
});

export function scenarioRoute(official, routeId) {
  const fallback = NEXT[routeId];
  if (!fallback) return null;
  const configured = official?.routing?.find(row => row.route_id === routeId && row.enabled !== false)?.next_page;
  // Routing can use existing flow IDs, but cannot bypass the required visual
  // stages or jump into protected calculation pages.
  const allowed = routeId === 'scenario_to_saving' ? ['P2'] : [fallback];
  return allowed.includes(configured) ? configured : fallback;
}
