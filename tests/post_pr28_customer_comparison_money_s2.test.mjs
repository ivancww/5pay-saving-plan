import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import { normalizeMoneyValue, parseMoney, formatMoneyInput } from '../src/money.js';
import { calculateSavingPortfolio, currentPath } from '../src/calculation.js';
import { investmentPath, scenarioRoute } from '../src/scenario-flow.js';
import { normalizeMoneyState } from '../src/state.js';
import { formatCustomerMoney, render } from '../src/views.js';
import { getExistingResourceFutureValue } from '../src/views.js';

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
  assert.ok(views.includes('概念示意'));
  assert.ok(views.includes('select-maturity-horizon'));
  assert.ok(views.includes('data-value="${year}"'));
  const moneyInputs = [...views.matchAll(/<input[^>]*data-money-input[^>]*>/g)].map(match => match[0]);
  assert.ok(moneyInputs.length >= 6);
  assert.ok((views.match(/data-money-input inputmode='numeric' type='text'/g) || []).length >= 4);
  assert.ok(main.includes('formatMoneyInputElement(target)'));
  assert.ok(main.includes('normalizeMoneyValue(parseMoney(target.value))'));
  assert.ok(views.includes('formatCustomerMoney'));
  assert.ok(main.includes('updateP3Live()'));
  assert.ok(!main.match(/formatMoneyInputElement\(target\)[\s\S]*render\(/));
  assert.ok(!styles.includes('overflow-x:hidden'));
  assert.ok(styles.includes('@media (max-width:650px)'));
  assert.ok(styles.includes('@media (max-width:1000px) and (min-width:651px)'));
  assert.ok(build.includes("APP_VERSION = 'V1.10'"));
});
