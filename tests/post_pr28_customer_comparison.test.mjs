import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { parseMoney, formatMoneyInput } from '../src/money.js';
import { MARKET_DATA, simulateHistoricalInvestment } from '../src/market-data.js';
import { buildScenario1Comparison, calculateSavingPortfolio, currentPath } from '../src/calculation.js';
import { scenarioRoute, investmentPath } from '../src/scenario-flow.js';

const official = {
  strategyMap: { none: 'none' },
  return_tables: {
    none: Array.from({ length: 15 }, (_, index) => ({ policy_year: index + 1, multiplier: 1 }))
  }
};

test('shared money formatter parses and formats customer values', () => {
  assert.equal(formatMoneyInput(1000), '1,000');
  assert.equal(formatMoneyInput(100000), '100,000');
  assert.equal(formatMoneyInput('1,000,000'), '1,000,000');
  assert.equal(parseMoney('HK$ 100,000'), 100000);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney(null), null);
});

test('P4 bank comparison reuses the same existing-deposit component', () => {
  const current = currentPath({
    method: 'cash',
    amount: 100000,
    projectionYears: 5,
    assumptions: { existingDeposit: 200000, cashRate: 2 }
  });
  const comparison = buildScenario1Comparison({
    method: 'cash',
    current,
    officialValue: 700000
  });
  assert.equal(comparison.existingDepositFutureValue, current.breakdown.existingDepositFutureValue);
  assert.equal(comparison.currentTotal, current.value);
  assert.equal(comparison.currentTotal, comparison.existingDepositFutureValue + current.breakdown.futureAnnualValue);
  assert.equal(comparison.longTermTotal, comparison.existingDepositFutureValue + 700000);
});

test('P6 contribution amount progresses by phase and stays flat after completion', () => {
  const session = {
    annualContribution: 100000,
    savingPhases: [
      { id: 1, annualContribution: 100000 },
      { id: 2, annualContribution: 80000 }
    ]
  };
  const expected = new Map([[5, 500000], [6, 580000], [7, 660000], [8, 740000], [9, 820000], [10, 900000], [15, 900000]]);
  for (const [year, amount] of expected) {
    const result = calculateSavingPortfolio({ session, overallPolicyYear: year, official });
    assert.equal(result.totalContribution, amount);
  }
});

test('historical market datasets are documented and deterministic', () => {
  for (const key of ['hsi', 'sp500']) {
    const dataset = MARKET_DATA[key];
    assert.equal(dataset.points.length, 10);
    assert.equal(dataset.points[0].year, 2016);
    assert.equal(dataset.points.at(-1).year, 2025);
    assert.equal(dataset.convention, 'price_close');
    assert.ok(dataset.source && dataset.sourceUrl && dataset.retrievedOn);
  }
  const first = simulateHistoricalInvestment({
    benchmark: 'hsi',
    initialInvestment: 1000,
    regularInvestment: 100,
    durationYears: 2,
    exitYear: 2018
  });
  const repeat = simulateHistoricalInvestment({
    benchmark: 'hsi',
    initialInvestment: 1000,
    regularInvestment: 100,
    durationYears: 2,
    exitYear: 2018
  });
  assert.deepEqual(first, repeat);
  assert.equal(first.totalInvested, 1200);
  assert.notEqual(first.finalValue, simulateHistoricalInvestment({
    benchmark: 'hsi',
    initialInvestment: 1000,
    regularInvestment: 100,
    durationYears: 2,
    exitYear: 2019
  }).finalValue);
  assert.notEqual(MARKET_DATA.hsi.points[0].value, MARKET_DATA.sp500.points[0].value);
});

test('Scenario 2 routes to P3 without reusing P2', () => {
  assert.equal(investmentPath(['stock']), 'S2_MARKET');
  assert.equal(investmentPath(['fixed_deposit']), 'S2_MATURITY');
  assert.equal(investmentPath(['stock', 'bond']), 'S2_MIXED');
  assert.equal(scenarioRoute({}, 'scenario_to_saving'), 'P3');
  assert.equal(scenarioRoute({}, 'scenario1'), 'P1');
});

test('customer-facing contracts retain V1.10, no mask, and no Saving Plan label', () => {
  const views = fs.readFileSync(new URL('../src/views.js', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const build = fs.readFileSync(new URL('../src/build.js', import.meta.url), 'utf8');
  assert.ok(views.includes('長期累積安排'));
  assert.ok(!views.includes('Saving Plan'));
  assert.ok(!styles.includes('overflow-x:hidden'));
  assert.ok(build.includes("APP_VERSION = 'V1.10'"));
});
