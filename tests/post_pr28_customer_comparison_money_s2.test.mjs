import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import { normalizeMoneyValue, parseMoney, formatMoneyInput, readInputValue } from '../src/money.js';
import { activeSavingPhases, calculateExistingResourceProjection, calculateFairPrincipalComparison, calculateSavingPortfolio, currentInstrumentSummary, currentPath, withdrawalPortfolio } from '../src/calculation.js';
import { investmentPath, scenarioRoute } from '../src/scenario-flow.js';
import { applySessionInput, effectiveAnnualContribution, handleP3InputEvent, normalizeMoneyState } from '../src/state.js';
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
  assert.doesNotMatch(app.innerHTML, /每年存款安排[\s\S]{0,200}—/);
});

test('clearing existing bank deposit immediately removes it from the comparison state', () => {
  const session = {
    scenario: 'scenario1', currentMethod: 'cash', annualContribution: 100000,
    currentAge: 40, assumptions: { existingDeposit: 700000, cashRate: 1 },
    savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
  };
  // This mirrors the canonical value produced by the real blank money input.
  session.assumptions.existingDeposit = readInputValue({ value: '', matches: selector => selector === '[data-money-input]' });
  normalizeMoneyState(session);
  assert.equal(session.assumptions.existingDeposit, null);
  const app = { innerHTML: '' };
  render(app, { pageId: 'P4', history: [], mode: 'use', customerView: false, session }, {
    flow: [{ page_id: 'P4', title: 'P4', subtitle: '' }], current_methods: [], return_tables: { none: [{ policy_year: 8, multiplier: 1 }] }
  });
  assert.doesNotMatch(app.innerHTML, /HK\$ 700,000/);
  assert.match(app.innerHTML, /現有存款[\s\S]*—/);
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

test('real P3 input-event path updates cash rate, deposit and annual contribution immediately', () => {
  const state = {
    pageId: 'P3', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'cash', annualContribution: null,
      currentAge: 40, assumptions: { existingDeposit: 200000, cashRate: null },
      savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  const nodes = new Map(['#p3-annual-contribution-value', '#p3-current-path-value', '#p3-current-path-unit', '#p3-current-path-status'].map(selector => [selector, { textContent: '', className: '' }]));
  const querySelector = selector => nodes.get(selector);
  const input = (dataset, value, money = false) => ({
    dataset, value, selectionStart: String(value).length, selectionEnd: String(value).length,
    matches: selector => money && selector === '[data-money-input]'
  });
  handleP3InputEvent({ session: state.session, target: input({ field: 'annualContribution' }, '100,000', true), querySelector });
  assert.equal(nodes.get('#p3-annual-contribution-value').textContent, 'HK$ 100,000');
  assert.equal(state.session.annualContribution, 100000);
  const before = nodes.get('#p3-current-path-value').textContent;
  handleP3InputEvent({ session: state.session, target: input({ assumption: 'cash-rate' }, '1'), querySelector });
  const afterOne = nodes.get('#p3-current-path-value').textContent;
  assert.notEqual(afterOne, before);
  assert.equal(state.session.assumptions.cashRate, 1);

  handleP3InputEvent({ session: state.session, target: input({ assumption: 'cash-rate' }, '2'), querySelector });
  const afterTwo = nodes.get('#p3-current-path-value').textContent;
  assert.notEqual(afterTwo, afterOne);
  assert.equal(state.session.assumptions.cashRate, 2);

  handleP3InputEvent({ session: state.session, target: input({ assumption: 'existing-deposit' }, '', true), querySelector });
  assert.equal(state.session.assumptions.existingDeposit, null);
  const afterClear = nodes.get('#p3-current-path-value').textContent;
  assert.notEqual(afterClear, afterTwo);

  handleP3InputEvent({ session: state.session, target: input({ assumption: 'existing-deposit' }, '300,000', true), querySelector });
  assert.equal(state.session.assumptions.existingDeposit, 300000);
  assert.notEqual(nodes.get('#p3-current-path-value').textContent, afterClear);

  handleP3InputEvent({ session: state.session, target: input({ field: 'annualContribution' }, '120,000', true), querySelector });
  assert.equal(state.session.annualContribution, 120000);
  assert.equal(nodes.get('#p3-annual-contribution-value').textContent, 'HK$ 120,000');
  assert.ok(![...nodes.values()].some(node => String(node.textContent).includes('NaN')));
});

test('fixed deposit P3 shows only the known current maturity and updates through the live holding-input path', () => {
  const state = {
    pageId: 'P3', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'fixed_deposit', annualContribution: 100000,
      currentAge: 40, assumptions: {
        existingDeposit: 200000,
        fixedDeposits: [{ id: 'fd-1', principal: 500000, termYears: 2, annualRate: 2.5 }]
      }, savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  const app = { innerHTML: '' };
  render(app, state, { ...official, current_methods: [{ method_key: 'fixed_deposit', display_name: '定期存款' }] });
  assert.match(app.innerHTML, /今期知道，下一期又會點？/);
  assert.match(app.innerHTML, /定期金額/);
  assert.match(app.innerHTML, /HK\$ 525,313/);
  assert.doesNotMatch(app.innerHTML, /8年後現有方法預計有幾多/);
  assert.match(app.innerHTML, /現有存款/);
  assert.match(app.innerHTML, /每年存放/);
  assert.doesNotMatch(app.innerHTML.split('ava-card input-card')[0], /每年存放/);

  const nodes = new Map(['#p3-current-path-value', '#p3-instrument-principal-value', '#p3-instrument-term-value', '#p3-instrument-rate-value', '#p3-annual-contribution-value', '#p3-current-path-unit', '#p3-current-path-status'].map(selector => [selector, { textContent: '', className: '' }]));
  const querySelector = selector => nodes.get(selector);
  const input = (dataset, value, money = false) => ({ dataset, value, selectionStart: String(value).length, selectionEnd: String(value).length, matches: selector => money && selector === '[data-money-input]' });
  handleP3InputEvent({ session: state.session, target: input({ holdingMethod: 'fixedDeposits', holdingIndex: '0', holdingField: 'principal' }, '600,000', true), querySelector });
  assert.equal(state.session.assumptions.fixedDeposits[0].principal, 600000);
  assert.equal(nodes.get('#p3-current-path-value').textContent, 'HK$ 630,375');
  handleP3InputEvent({ session: state.session, target: input({ holdingMethod: 'fixedDeposits', holdingIndex: '0', holdingField: 'termYears' }, '3'), querySelector });
  assert.equal(nodes.get('#p3-current-path-value').textContent, 'HK$ 646,134');
  handleP3InputEvent({ session: state.session, target: input({ holdingMethod: 'fixedDeposits', holdingIndex: '0', holdingField: 'annualRate' }, '3'), querySelector });
  assert.equal(nodes.get('#p3-current-path-value').textContent, 'HK$ 655,636');
  assert.equal(currentInstrumentSummary({ method: 'fixed_deposit', assumptions: state.session.assumptions }).value, 600000 * 1.03 ** 3);
});

test('FD/Bond P3 keeps Resource A separate from the current instrument rate', () => {
  const state = {
    pageId: 'P3', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'fixed_deposit', annualContribution: 100000,
      currentAge: 40,
      assumptions: {
        existingDeposit: 200000, cashRate: 1,
        fixedDeposits: [{ id: 'fd-1', principal: 500000, termYears: 2, annualRate: 2.5 }]
      },
      savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  const resourceAtOne = calculateExistingResourceProjection({ existingDeposit: 200000, annualContribution: 100000, cashRate: 1, projectionYears: 8 });
  const maturityAtTwoPointFive = currentInstrumentSummary({ method: 'fixed_deposit', assumptions: state.session.assumptions }).value;
  assert.equal(Math.round(maturityAtTwoPointFive), 525313);
  state.session.assumptions.cashRate = 2;
  const resourceAtTwo = calculateExistingResourceProjection({ existingDeposit: 200000, annualContribution: 100000, cashRate: 2, projectionYears: 8 });
  assert.notEqual(resourceAtOne.value, resourceAtTwo.value);
  assert.equal(Math.round(currentInstrumentSummary({ method: 'fixed_deposit', assumptions: state.session.assumptions }).value), 525313);
  state.session.assumptions.fixedDeposits[0].annualRate = 3;
  const maturityAtThree = currentInstrumentSummary({ method: 'fixed_deposit', assumptions: state.session.assumptions }).value;
  assert.equal(Math.round(maturityAtThree), 530450);
  assert.equal(resourceAtTwo.value, calculateExistingResourceProjection({ existingDeposit: 200000, annualContribution: 100000, cashRate: 2, projectionYears: 8 }).value);

  const app = { innerHTML: '' };
  render(app, state, { ...official, current_methods: [{ method_key: 'fixed_deposit', display_name: '定期存款' }] });
  assert.match(app.innerHTML, /現有存款安排/);
  assert.match(app.innerHTML, /p3-existing-resource-value/);
  assert.match(app.innerHTML, /現有存款利息/);
  assert.doesNotMatch(app.innerHTML, /8年後現有方法預計有幾多/);
});

test('FD/Bond P3 live input events update the corresponding resource and maturity DOM', () => {
  const session = {
    scenario: 'scenario1', currentMethod: 'fixed_deposit', annualContribution: 100000,
    currentAge: 40,
    assumptions: { existingDeposit: 200000, cashRate: null, fixedDeposits: [{ id: 'fd-1', principal: 500000, termYears: 2, annualRate: 2.5 }] },
    savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
  };
  const selectors = ['#p3-current-path-value', '#p3-instrument-principal-value', '#p3-instrument-term-value', '#p3-instrument-rate-value', '#p3-annual-contribution-value', '#p3-existing-resource-value', '#p3-current-path-unit', '#p3-current-path-status'];
  const nodes = new Map(selectors.map(selector => [selector, { textContent: '', className: '' }]));
  const querySelector = selector => nodes.get(selector);
  const input = (dataset, value, money = false) => ({ dataset, value, selectionStart: String(value).length, selectionEnd: String(value).length, matches: selector => money && selector === '[data-money-input]' });

  handleP3InputEvent({ session, target: input({ assumption: 'cash-rate' }, '1'), querySelector });
  const resourceAtOne = nodes.get('#p3-existing-resource-value').textContent;
  handleP3InputEvent({ session, target: input({ assumption: 'cash-rate' }, '2'), querySelector });
  assert.notEqual(nodes.get('#p3-existing-resource-value').textContent, resourceAtOne);
  handleP3InputEvent({ session, target: input({ assumption: 'existing-deposit' }, '', true), querySelector });
  assert.equal(session.assumptions.existingDeposit, null);
  assert.match(nodes.get('#p3-existing-resource-value').textContent, /^HK\$ /);
  handleP3InputEvent({ session, target: input({ field: 'annualContribution' }, '120,000', true), querySelector });
  assert.equal(session.annualContribution, 120000);
  handleP3InputEvent({ session, target: input({ holdingMethod: 'fixedDeposits', holdingIndex: '0', holdingField: 'principal' }, '600,000', true), querySelector });
  assert.equal(nodes.get('#p3-current-path-value').textContent, 'HK$ 630,375');
  handleP3InputEvent({ session, target: input({ holdingMethod: 'fixedDeposits', holdingIndex: '0', holdingField: 'termYears' }, '3'), querySelector });
  handleP3InputEvent({ session, target: input({ holdingMethod: 'fixedDeposits', holdingIndex: '0', holdingField: 'annualRate' }, '3'), querySelector });
  assert.equal(nodes.get('#p3-current-path-value').textContent, 'HK$ 655,636');
});

test('bond P3 uses current known maturity data without an artificial long-term projection', () => {
  const state = {
    pageId: 'P3', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'bond', annualContribution: 80000,
      currentAge: 40, assumptions: { existingDeposit: null, bonds: [{ id: 'bond-1', principal: 300000, termYears: 5, annualRate: 4 }] },
      savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  const app = { innerHTML: '' };
  render(app, state, { ...official, current_methods: [{ method_key: 'bond', display_name: '債券' }] });
  assert.match(app.innerHTML, /債券金額/);
  assert.match(app.innerHTML, /HK\$ 360,000/);
  assert.match(app.innerHTML, /今期到期金額/);
  assert.doesNotMatch(app.innerHTML, /8年後現有方法預計有幾多/);
  assert.match(app.innerHTML, /現有存款/);
  assert.match(app.innerHTML, /每年存放/);
  assert.doesNotMatch(app.innerHTML.split('ava-card input-card')[0], /每年存放/);

  const nodes = new Map(['#p3-current-path-value', '#p3-instrument-principal-value', '#p3-instrument-term-value', '#p3-instrument-rate-value', '#p3-annual-contribution-value', '#p3-existing-resource-value', '#p3-current-path-unit', '#p3-current-path-status'].map(selector => [selector, { textContent: '', className: '' }]));
  const querySelector = selector => nodes.get(selector);
  const input = (dataset, value, money = false) => ({ dataset, value, selectionStart: String(value).length, selectionEnd: String(value).length, matches: selector => money && selector === '[data-money-input]' });
  handleP3InputEvent({ session: state.session, target: input({ holdingMethod: 'bonds', holdingIndex: '0', holdingField: 'annualRate' }, '5'), querySelector });
  assert.equal(nodes.get('#p3-current-path-value').textContent, 'HK$ 375,000');
  handleP3InputEvent({ session: state.session, target: input({ holdingMethod: 'bonds', holdingIndex: '0', holdingField: 'termYears' }, '3'), querySelector });
  assert.equal(nodes.get('#p3-current-path-value').textContent, 'HK$ 345,000');
});

test('fair P4 values expose cumulative Bank principal and split post-saving Bank principal', () => {
  const fair = calculateFairPrincipalComparison({
    existingDeposit: 200000, cashRate: 2, annualContribution: 100000, projectionYears: 8, official
  });
  assert.equal(fair.bankAnnualPrincipal, 800000);
  assert.equal(fair.savingBankPrincipal, 500000);
  assert.equal(fair.savingContributionPrincipal, 500000);
  assert.equal(fair.bankPrincipal, fair.savingPrincipal);
});

test('FD/Bond P4 keeps Resource A at the selected year and never derives false instrument growth', () => {
  const state = {
    pageId: 'P4', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'fixed_deposit', annualContribution: 100000,
      currentAge: 40, policyYear: 12,
      assumptions: { existingDeposit: 300000, cashRate: 1, fixedDeposits: [{ id: 'fd-1', principal: 200000, termYears: 1, annualRate: 3 }] },
      savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  const app = { innerHTML: '' };
  const p4Official = { ...official, current_methods: [{ method_key: 'fixed_deposit', display_name: '定期存款' }] };
  render(app, state, p4Official);
  assert.match(app.innerHTML, /現有存款安排 · 以第12年計算/);
  assert.match(app.innerHTML, /定期金額<\/span><strong>HK\$ 200,000/);
  assert.match(app.innerHTML, /今期累積增長<\/span><strong>HK\$ 6,000/);
  assert.match(app.innerHTML, /今期到期金額<\/span><strong>HK\$ 206,000/);
  assert.doesNotMatch(app.innerHTML, /HK\$ -194,000/);
  assert.doesNotMatch(app.innerHTML, /累積增長<\/span><strong>HK\$ -/);
  const resourceAt12 = calculateExistingResourceProjection({ existingDeposit: 300000, annualContribution: 100000, cashRate: 1, projectionYears: 12 });
  assert.match(app.innerHTML, new RegExp(`累積結果<\/span><strong>HK\\$ ${Math.round(resourceAt12.value).toLocaleString('en-US')}`));

  state.session.policyYear = 13;
  render(app, state, p4Official);
  const resourceAt13 = calculateExistingResourceProjection({ existingDeposit: 300000, annualContribution: 100000, cashRate: 1, projectionYears: 13 });
  assert.match(app.innerHTML, /現有存款安排 · 以第13年計算/);
  assert.match(app.innerHTML, new RegExp(`累積結果<\/span><strong>HK\\$ ${Math.round(resourceAt13.value).toLocaleString('en-US')}`));
  assert.match(app.innerHTML, /今期到期金額<\/span><strong>HK\$ 206,000/);

  state.session.currentMethod = 'bond';
  state.session.assumptions = { existingDeposit: 300000, cashRate: 1, bonds: [{ id: 'bond-1', principal: 300000, termYears: 5, annualRate: 4 }] };
  render(app, state, { ...official, current_methods: [{ method_key: 'bond', display_name: '債券' }] });
  assert.match(app.innerHTML, /債券金額<\/span><strong>HK\$ 300,000/);
  assert.match(app.innerHTML, /今期累積增長<\/span><strong>HK\$ 60,000/);
  assert.match(app.innerHTML, /今期到期金額<\/span><strong>HK\$ 360,000/);
  assert.doesNotMatch(app.innerHTML, /HK\$ -/);
});

test('P4 rendered cards switch fair principal rows with the selected year', () => {
  const state = {
    pageId: 'P4', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'cash', annualContribution: 100000,
      currentAge: 40, policyYear: 8, assumptions: { existingDeposit: 200000, cashRate: 2 },
      savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  const app = { innerHTML: '' };
  for (const [year, bankAnnual, savingBank] of [[8, '800,000', '500,000'], [9, '900,000', '600,000'], [10, '1,000,000', '700,000'], [13, '1,300,000', '1,000,000']]) {
    state.session.policyYear = year;
    render(app, state, official);
    assert.match(app.innerHTML, new RegExp(`每年安排</span><strong>HK\\$ ${bankAnnual}`));
    assert.match(app.innerHTML, new RegExp(`現有存款</span><strong>HK\\$ ${savingBank}`));
    assert.doesNotMatch(app.innerHTML, /NaN/);
  }
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
  assert.doesNotMatch(customerViewSource, /customerScenario1Resources|scenario1Resources/);
  assert.ok(views.includes('複利儲蓄安排'));
  assert.ok(views.includes('p4-simple-comparison'));
  assert.ok(views.includes('p7-summary-note'));
  assert.ok(!views.includes('p7-comparison-card'));
  assert.ok(views.includes('截至呢個時間點已安排'));
  assert.ok(views.includes('累積增長'));
  assert.ok(views.includes('每年存款安排'));
  assert.ok(views.includes('8年後現有方法預計有幾多'));
  assert.ok(!views.includes('現有方法目前資源'));
  assert.ok(!views.includes('另一筆 Saving'));
  assert.ok(!views.includes('Saving 只使用'));
  assert.ok(!views.includes('exact Official value'));
  assert.ok(main.includes('updateP3LiveDom'));
  assert.ok(main.includes('handleP3InputEvent({'));
  assert.ok(main.includes('if (p3Editing) {'));
  assert.ok(main.includes('continue-scenario2-to-saving'));
  assert.ok(main.includes('continue-scenario3-to-saving'));
  assert.ok(!main.includes("scenarioRoute(official, 'scenario_to_saving')"));
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

test('P4, P6 and Scenario 1 P7 use simplified result layouts without changing values', () => {
  const officialForPages = {
    ...official,
    current_methods: [{ method_key: 'cash', display_name: '銀行／現金' }]
  };
  const state = {
    pageId: 'P4', history: [], mode: 'use', customerView: false,
    session: {
      scenario: 'scenario1', currentMethod: 'cash', annualContribution: 100000,
      currentAge: 40, policyYear: 5,
      assumptions: { existingDeposit: 500000, cashRate: 1 },
      savingPhases: [{ id: 1, strategyCode: null, withdrawalPolicyYear: null }]
    }
  };
  const app = { innerHTML: '' };
  render(app, state, officialForPages);
  assert.equal((app.innerHTML.match(/resource-card--current/g) || []).length, 1);
  assert.equal((app.innerHTML.match(/resource-card--new/g) || []).length, 1);
  assert.match(app.innerHTML, /現有存款/);
  assert.match(app.innerHTML, /每年安排/);
  assert.match(app.innerHTML, /累積增長/);
  assert.match(app.innerHTML, /總額/);
  assert.doesNotMatch(app.innerHTML, /resource-summary|resource-section--overall/);

  state.pageId = 'P6';
  state.session.policyYear = 3;
  render(app, state, officialForPages);
  assert.match(app.innerHTML, /截至呢個時間點已安排/);
  assert.match(app.innerHTML, /HK\$ 300,000/);
  assert.doesNotMatch(app.innerHTML, /anchor-metric--secondary|計劃總投入/);

  state.pageId = 'P7';
  state.session.savingPhases = [{ id: 1, annualContribution: 100000, strategyCode: 'none', withdrawalPolicyYear: 5 }];
  render(app, state, officialForPages);
  assert.equal((app.innerHTML.match(/p7-comparison-card/g) || []).length, 0);
  assert.doesNotMatch(app.innerHTML, /resource-card--current|resource-card--new/);
  assert.match(app.innerHTML, /p7-summary-note/);

  state.session.savingPhases = [
    { id: 1, annualContribution: 100000, strategyCode: 'none', withdrawalPolicyYear: 5 },
    { id: 2, annualContribution: 80000, strategyCode: 'none', withdrawalPolicyYear: 5 }
  ];
  render(app, state, officialForPages);
  assert.equal((app.innerHTML.match(/data-phase-metric/g) || []).length >= 2, true);
  assert.match(app.innerHTML, /withdrawal-summary/);
  assert.match(app.innerHTML, /合計每年可使用/);
  assert.match(app.innerHTML, /合計累積已使用/);
  assert.match(app.innerHTML, /合計戶口價值/);
});

test('Customer View keeps the blue combined account-value card clear and aggregate-backed', () => {
  const state = {
    pageId: 'P7', history: [], mode: 'use', customerView: true,
    session: {
      scenario: 'scenario1', currentMethod: 'cash', annualContribution: 100000,
      currentAge: 40, assumptions: { existingDeposit: 200000, cashRate: 2 },
      savingPhases: [
        { id: 1, annualContribution: 100000, strategyCode: 'none', withdrawalPolicyYear: 8 },
        { id: 2, annualContribution: 100000, strategyCode: 'none', withdrawalPolicyYear: 8 }
      ]
    }
  };
  const app = { innerHTML: '' };
  render(app, state, official);
  const aggregate = withdrawalPortfolio(state.session, official).result;
  assert.match(app.innerHTML, /複利儲蓄安排 · 2 期/);
  assert.match(app.innerHTML, /2期合計戶口價值 · 按各期目前使用設定/);
  assert.match(app.innerHTML, new RegExp(formatCustomerMoney(aggregate.remainingValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(app.innerHTML, /withdrawal-summary|整體效果/);
  const actionContainer = app.innerHTML.match(/<div class="actions presentation-actions customer-summary-actions"[^>]*data-summary-actions="right"[^>]*>([\s\S]*?)<\/div>/)?.[0] || '';
  assert.ok(actionContainer);
  assert.match(actionContainer, /data-action="print"/);
  assert.match(actionContainer, /data-action="close-customer"/);
  assert.match(actionContainer, /customer-summary-actions/);
});
