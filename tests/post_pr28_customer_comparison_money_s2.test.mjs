import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import { normalizeMoneyValue, parseMoney, formatMoneyInput, readInputValue } from '../src/money.js';
import { activeSavingPhases, calculateSavingPortfolio, currentPath } from '../src/calculation.js';
import { investmentPath, scenarioRoute } from '../src/scenario-flow.js';
import { effectiveAnnualContribution, normalizeMoneyState } from '../src/state.js';
import { formatCustomerMoney, marketSimulatorResult, render } from '../src/views.js';
import { getExistingResourceFutureValue } from '../src/views.js';
import { SCENARIO2_MARKET_HISTORY, normalizedMarketSeries, simulateMarketHistory } from '../src/scenario2-market-history.js';

const official = {
  strategyMap: { none: 'none' },
  return_tables: {
    none: Array.from({ length: 15 }, (_, index) => ({ policy_year: index + 1, multiplier: 1 }))
  }
};

test('money values format, parse, clear and paste without numeric corruption', () => {
  assert.equal(formatMoneyInput(1000), '1,000');
  assert.equal(formatMoneyInput(100000), '100,000');
  assert.equal(formatMoneyInput(1000000), '1,000,000');
  assert.equal(parseMoney('1,250,000'), 1250000);
  assert.equal(parseMoney('HK$ 1,250,000'), 1250000);
  assert.equal(parseMoney(''), null);
});

test('formatted money input updates canonical state before P3 render', () => {
  const session = {
    scenario: 'scenario1', currentMethod: 'cash', annualContribution: null,
    currentAge: 40, assumptions: { existingDeposit: null, cashRate: null },
    savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
  };
  const target = {
    value: '100,000',
    matches: selector => selector === '[data-money-input]',
    hasAttribute: name => name === 'data-money-input'
  };
  session.annualContribution = readInputValue(target);
  normalizeMoneyState(session);
  assert.equal(session.annualContribution, 100000);
  assert.equal(effectiveAnnualContribution(session), 100000);

  const app = { innerHTML: '' };
  render(app, { pageId: 'P3', history: [], mode: 'use', customerView: false, session }, {
    flow: [{ page_id: 'P3', title: 'P3', subtitle: '' }], current_methods: [], page_content: []
  });
  assert.match(app.innerHTML, /HK\$ 100,000/);
  assert.doesNotMatch(app.innerHTML, /NaN/);

  session.currentAge = 30;
  session.currentAge = 40;
  render(app, { pageId: 'P3', history: [], mode: 'use', customerView: false, session }, {
    flow: [{ page_id: 'P3', title: 'P3', subtitle: '' }], current_methods: [], page_content: []
  });
  assert.match(app.innerHTML, /HK\$ 100,000/);
});

test('new annual arrangement remains valid without an existing FD resource', () => {
  const state = {
    pageId: 'P3', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'fixed_deposit', annualContribution: null,
      currentAge: 40, assumptions: { fixedDeposits: [] },
      savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  state.session.annualContribution = readInputValue({ value: '100,000', matches: s => s === '[data-money-input]' });
  normalizeMoneyState(state.session);
  const app = { innerHTML: '' };
  render(app, state, { flow: [{ page_id: 'P3', title: 'P3', subtitle: '' }], current_methods: [], page_content: [] });
  assert.match(app.innerHTML, /HK\$ 100,000/);
  assert.doesNotMatch(app.innerHTML, /每年複利儲蓄安排[\s\S]{0,200}—/);
});

test('money formatting and malformed state never produce NaN customer output', () => {
  assert.equal(formatMoneyInput(null), '');
  assert.equal(formatMoneyInput(''), '');
  assert.equal(formatMoneyInput(NaN), '');
  assert.equal(formatMoneyInput(Infinity), '');
  assert.equal(formatMoneyInput(-Infinity), '');
  assert.equal(formatMoneyInput(100000), '100,000');
  assert.equal(formatMoneyInput('100,000'), '100,000');
  assert.equal(formatMoneyInput('HK$ 1,250,000'), '1,250,000');
  assert.equal(normalizeMoneyValue(''), null);
  assert.equal(formatCustomerMoney(100000), 'HK$ 100,000');
  assert.equal(formatCustomerMoney(NaN), '—');
  assert.equal(formatCustomerMoney(Infinity), '—');

  const session = {
    annualContribution: NaN,
    assumptions: {
      existingDeposit: NaN,
      existingValue: Infinity,
      fixedDeposits: [{ principal: NaN, termYears: 2, annualRate: 3.5 }],
      bonds: [{ principal: -Infinity, termYears: 5, annualRate: 4 }]
    },
    savingPhases: [{ id: 1, annualContribution: NaN }]
  };
  normalizeMoneyState(session);
  assert.equal(session.annualContribution, null);
  assert.equal(session.assumptions.existingDeposit, null);
  assert.equal(session.assumptions.existingValue, null);
  assert.equal(session.assumptions.fixedDeposits[0].principal, null);
  assert.equal(session.assumptions.bonds[0].principal, null);
  assert.equal(session.savingPhases[0].annualContribution, null);

  const app = { innerHTML: '' };
  render(app, {
    pageId: 'P3',
    history: [],
    mode: 'use',
    customerView: false,
    session: {
      scenario: 'scenario1',
      currentMethod: 'cash',
      annualContribution: NaN,
      currentAge: 35,
      assumptions: { existingDeposit: NaN, cashRate: null }
    }
  }, { flow: [{ page_id: 'P3', title: 'P3', subtitle: '' }], current_methods: [], page_content: [] });
  assert.ok(!app.innerHTML.includes('NaN'));
  assert.ok(!app.innerHTML.includes('HK$ NaN'));
});

test('missing phase annual contribution inherits session amount after normalization', () => {
  const session = {
    annualContribution: 100000,
    savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
  };
  normalizeMoneyState(session);
  assert.equal(Object.prototype.hasOwnProperty.call(session.savingPhases[0], 'annualContribution'), false);
  assert.equal(activeSavingPhases(session)[0].annualContribution, 100000);
});

test('P3 renders inherited Phase 1 contribution and preserves it when age changes', () => {
  const state = {
    pageId: 'P3', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'cash', annualContribution: 100000,
      currentAge: 30, assumptions: { existingDeposit: null, cashRate: null },
      savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  const app = { innerHTML: '' };
  const officialP3 = { flow: [{ page_id: 'P3', title: 'P3', subtitle: '' }], current_methods: [], page_content: [] };
  render(app, state, officialP3);
  assert.equal(effectiveAnnualContribution(state.session), 100000);
  assert.ok(app.innerHTML.includes('HK$ 100,000'));
  state.session.currentAge = 31;
  render(app, state, officialP3);
  assert.ok(app.innerHTML.includes('HK$ 100,000'));
});

test('exact-observation market simulator covers all series without interpolation', () => {
  for (const key of ['hsi', 'sp500', 'tracker2800', 'spy']) {
    const series = normalizedMarketSeries(key);
    const first = series.observations[0];
    const last = series.observations.at(-1);
    const result = simulateMarketHistory({ seriesKey: key, principal: 100000, startYear: first.year, endYear: last.year });
    assert.equal(result.available, true);
    assert.equal(result.simulatedValue, 100000 * (last.normalized / first.normalized));
    assert.equal(result.profitLoss, result.simulatedValue - 100000);
    assert.equal(result.returnPercent, (last.normalized / first.normalized - 1) * 100);
    assert.equal(simulateMarketHistory({ seriesKey: key, principal: 100000, startYear: first.year, endYear: first.year }).available, false);
    assert.equal(simulateMarketHistory({ seriesKey: key, principal: 100000, startYear: last.year, endYear: first.year }).available, false);
    assert.equal(simulateMarketHistory({ seriesKey: key, principal: 100000, startYear: '2015', endYear: last.year }).available, false);
    assert.ok(!marketSimulatorResult({
      session: { investmentTools: key === 'hsi' || key === 'sp500' ? ['stock'] : ['etf'], marketHistorySeries: key, marketPrincipal: 100000, marketStartYear: first.year, marketEndYear: last.year }
    }).includes('NaN'));
  }
});

test('explicit phase override remains independent from inherited Phase 1 amount', () => {
  const session = {
    annualContribution: 100000,
    savingPhases: [
      { id: 1, strategyCode: null, withdrawalPolicyYear: null },
      { id: 2, annualContribution: 80000, strategyCode: null, withdrawalPolicyYear: null }
    ]
  };
  normalizeMoneyState(session);
  const phases = activeSavingPhases(session);
  assert.equal(phases[0].annualContribution, 100000);
  assert.equal(phases[1].annualContribution, 80000);
});

test('Scenario 2 market history is sourced, normalized and finite for all four references', () => {
  for (const key of ['hsi', 'sp500', 'tracker2800', 'spy']) {
    const raw = SCENARIO2_MARKET_HISTORY[key];
    const series = normalizedMarketSeries(key);
    assert.ok(raw?.primarySource?.name && raw?.primarySource?.url);
    assert.equal(raw.dataThroughDate, '2025-12-31');
    assert.equal(raw.verifiedAt, '2026-10-13');
    assert.equal(series.observations[0].normalized, 100);
    assert.ok(series.observations.length >= 10);
    assert.ok(series.observations.every(item => Number.isFinite(item.value) && Number.isFinite(item.normalized)));
  }
});

test('market evidence separates data-through date from verification date and matches the displayed basis', () => {
  const evidence = JSON.parse(fs.readFileSync(new URL('../research/evidence/scenario2-market-history-2026-10-13.json', import.meta.url), 'utf8'));
  for (const item of evidence.observations) {
    assert.equal(item.data_through_date, '2025-12-31');
    assert.equal(item.verified_at, '2026-10-13');
    assert.equal(item.observations.at(-1)[0], '2025');
    assert.ok(item.normalization_method);
    assert.ok(item.dividend_distribution_treatment);
    assert.ok(item.fx_treatment);
  }
  const spyEvidence = evidence.observations.find(item => item.series_id === 'spy');
  assert.equal(spyEvidence.display_basis, SCENARIO2_MARKET_HISTORY.spy.displayBasis);
  assert.equal(spyEvidence.raw_data_type, SCENARIO2_MARKET_HISTORY.spy.rawDataType);
  const trackerEvidence = evidence.observations.find(item => item.series_id === 'tracker2800');
  assert.match(trackerEvidence.raw_data_type, /derived normalized cumulative/);
  assert.match(trackerEvidence.normalization_method, /2016 baseline = 100/);

  const app = { innerHTML: '' };
  render(app, {
    pageId: 'S2_MARKET',
    history: [],
    mode: 'use',
    customerView: false,
    session: { scenario: 'scenario2', investmentTools: ['stock'], marketResponse: null, marketHistorySeries: 'hsi' }
  }, { flow: [{ page_id: 'S2_MARKET', title: '市場', subtitle: '' }], page_content: [] });
  assert.ok(app.innerHTML.includes('歷史數據至 2025 年底'));
  assert.ok(app.innerHTML.includes('資料核對日期 2026-10-13'));
  assert.ok(!app.innerHTML.includes('數據截至 2026-10-13'));
  assert.ok(!app.innerHTML.includes('2026 年底'));
});

test('bank P4 keeps existing resource separate from the new-arrangement comparison', () => {
  const current = currentPath({
    method: 'cash',
    amount: 100000,
    projectionYears: 15,
    assumptions: { existingDeposit: 500000, cashRate: 1 }
  });
  assert.equal(Math.round(current.breakdown.existingDepositFutureValue), 580484);
  assert.equal(current.value, current.breakdown.existingDepositFutureValue + current.breakdown.futureAnnualValue);
  assert.notEqual(current.breakdown.existingDepositFutureValue, current.breakdown.futureAnnualValue);
});

test('generic existing-resource values support bank, fixed deposit and bond totals', () => {
  const savingValue = 930000;
  const bankExisting = getExistingResourceFutureValue({ breakdown: { existingDepositFutureValue: 580484 }, details: [] });
  const fixedDepositExisting = getExistingResourceFutureValue({ details: [{ value: 430000 }] });
  const bondExisting = getExistingResourceFutureValue({ details: [{ value: 360000 }] });
  assert.equal(bankExisting + savingValue, 1510484);
  assert.equal(fixedDepositExisting + savingValue, 1360000);
  assert.equal(bondExisting + savingValue, 1290000);
});

test('P6 preserves planned total and current-time contribution separately', () => {
  const session = {
    annualContribution: 100000,
    savingPhases: [
      { id: 1, annualContribution: 100000 },
      { id: 2, annualContribution: 100000 }
    ]
  };
  const early = calculateSavingPortfolio({ session, overallPolicyYear: 3, official });
  const later = calculateSavingPortfolio({ session, overallPolicyYear: 8, official });
  assert.equal(early.plannedContribution, 1000000);
  assert.equal(early.totalContribution, 300000);
  assert.equal(later.totalContribution, 800000);
  assert.equal(early.availablePhaseCount, 1);
});

test('Scenario 2 retains all four tools and has a dedicated route separate from Scenario 3', () => {
  for (const selected of [
    ['stock'], ['etf'], ['stock', 'etf'],
    ['fixed_deposit'], ['bond'], ['fixed_deposit', 'bond'],
    ['stock', 'fixed_deposit'], ['etf', 'bond'],
    ['stock', 'etf', 'fixed_deposit', 'bond']
  ]) {
    assert.ok(investmentPath(selected));
  }
  assert.equal(scenarioRoute({}, 'scenario2_to_saving'), 'P3');
  assert.equal(scenarioRoute({}, 'scenario3_to_saving'), 'P2');
  assert.equal(scenarioRoute({}, 'scenario_to_saving'), null);
  assert.equal(scenarioRoute({}, 'scenario1'), 'P1');
});

test('customer-facing source contracts preserve focus-safe live update and responsive rules', () => {
  const views = fs.readFileSync(new URL('../src/views.js', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const build = fs.readFileSync(new URL('../src/build.js', import.meta.url), 'utf8');
  assert.ok(views.includes('目前已有資源'));
  const customerViewStart = views.indexOf('function customerView');
  const customerViewSource = views.slice(customerViewStart, views.indexOf('function unavailable', customerViewStart));
  assert.ok(customerViewSource.includes("scenario === 'scenario1' ? customerScenario1Resources(state, official, phases) : ''"));
  assert.ok(customerViewSource.includes('${scenario1Resources}'));
  assert.ok(views.includes('現有資源總額'));
  assert.ok(views.includes('複利儲蓄安排'));
  assert.ok(views.includes('合計資源'));
  assert.ok(views.includes("const overallResourceValue = existingResourceFutureValue != null"));
  assert.ok(views.includes("const currentNew = current.breakdown?.futureAnnualValue != null"));
  assert.ok(!views.includes('現有方法目前資源'));
  assert.ok(!views.includes('另一筆 Saving'));
  assert.ok(!views.includes('Saving 只使用'));
  assert.ok(!views.includes('exact Official value'));
  assert.ok(main.includes('continue-scenario2-to-saving'));
  assert.ok(main.includes('continue-scenario3-to-saving'));
  assert.ok(!main.includes("scenarioRoute(official, 'scenario_to_saving')"));
  assert.ok(views.includes('同一筆新增安排'));
  assert.ok(views.includes('計劃總投入'));
  assert.ok(views.includes('截至呢個時間點已安排'));
  assert.ok(views.includes('過去10年，實際行過點？'));
  assert.ok(views.includes('以起點 = 100 作歷史走勢比較'));
  assert.ok(views.includes('歷史數據至'));
  assert.ok(views.includes('資料核對日期'));
  assert.ok(views.includes('select-market-history-series'));
  assert.ok(views.includes('market-simulator-controls'));
  assert.ok(views.includes('marketSimulatorResult'));
  assert.ok(views.includes('data-market-start'));
  assert.ok(views.includes('歷史行完，我哋可以睇到結果'));
  assert.ok(views.includes('select-maturity-horizon'));
  assert.ok(views.includes('data-value="${year}"'));
  const moneyInputs = [...views.matchAll(/<input[^>]*data-money-input[^>]*>/g)].map(match => match[0]);
  assert.ok(moneyInputs.length >= 6);
  assert.ok((views.match(/data-money-input inputmode='numeric' type='text'/g) || []).length >= 4);
  assert.ok(main.includes('formatMoneyInputElement(target)'));
  assert.ok(main.includes('readInputValue(target)'));
  assert.ok(views.includes('formatCustomerMoney'));
  assert.ok(main.includes('updateP3Live()'));
  assert.ok(!main.match(/formatMoneyInputElement\(target\)[\s\S]*render\(/));
  assert.ok(!styles.includes('overflow-x:hidden'));
  assert.ok(styles.includes('@media (max-width:650px)'));
  assert.ok(styles.includes('@media (max-width:1000px) and (min-width:651px)'));
  assert.match(build, /APP_VERSION = 'V\d+\.\d+\.\d+'/);
});
