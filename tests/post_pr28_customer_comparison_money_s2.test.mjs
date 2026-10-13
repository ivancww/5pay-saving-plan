import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import { parseMoney, formatMoneyInput } from '../src/money.js';
import { calculateSavingPortfolio, currentPath } from '../src/calculation.js';
import { investmentPath, scenarioRoute } from '../src/scenario-flow.js';

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

test('Scenario 2 retains all four tools and routes into P3 after both branches', () => {
  for (const selected of [
    ['stock'], ['etf'], ['stock', 'etf'],
    ['fixed_deposit'], ['bond'], ['fixed_deposit', 'bond'],
    ['stock', 'fixed_deposit'], ['etf', 'bond'],
    ['stock', 'etf', 'fixed_deposit', 'bond']
  ]) {
    assert.ok(investmentPath(selected));
  }
  assert.equal(scenarioRoute({}, 'scenario_to_saving'), 'P3');
  assert.equal(scenarioRoute({}, 'scenario1'), 'P1');
});

test('customer-facing source contracts preserve focus-safe live update and responsive rules', () => {
  const views = fs.readFileSync(new URL('../src/views.js', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const build = fs.readFileSync(new URL('../src/build.js', import.meta.url), 'utf8');
  assert.ok(views.includes('目前已有資源'));
  assert.ok(views.includes('同一筆新增安排'));
  assert.ok(views.includes('計劃總投入'));
  assert.ok(views.includes('截至呢個時間點已安排'));
  assert.ok(views.includes('概念示意'));
  assert.ok(views.includes('select-maturity-horizon'));
  assert.ok(views.includes('data-value="${year}"'));
  const moneyInputs = [...views.matchAll(/<input[^>]*data-money-input[^>]*>/g)].map(match => match[0]);
  assert.ok(moneyInputs.length >= 6);
  assert.ok(moneyInputs.every(input => !/type=['"]number['"]/.test(input)));
  assert.ok(main.includes('formatMoneyInputElement(target)'));
  assert.ok(main.includes('updateP3Live()'));
  assert.ok(!main.match(/formatMoneyInputElement\(target\)[\s\S]*render\(/));
  assert.ok(!styles.includes('overflow-x:hidden'));
  assert.ok(styles.includes('@media (max-width:650px)'));
  assert.ok(styles.includes('@media (max-width:1000px) and (min-width:651px)'));
  assert.ok(build.includes("APP_VERSION = 'V1.10'"));
});
