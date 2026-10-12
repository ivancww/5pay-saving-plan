import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateBankValue, futureValueWithEndOfYearContributions,
  calculateFixedDepositValue, calculateBondValue, currentPath, calculateSavingPortfolio,
  withdrawalPortfolio
} from '../src/calculation.js';

const approx = (actual, expected, tolerance = 0.5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
const official = {
  strategyMap: { none: 'none', withdraw7_from8: 'withdraw7_from8' },
  strategies: [{ strategy_code: 'withdraw7_from8', start_year: 8, withdraw_rate: 0.1 }],
  return_tables: {
    none: [5, 8, 10, 15].map(policy_year => ({ policy_year, multiplier: 1.2 })),
    withdraw7_from8: [8, 10, 15].map(policy_year => ({ policy_year, multiplier: 1.1, withdrawal_rate: 0.1 }))
  }
};

test('bank existing deposit compounds only when a rate is supplied', () => {
  approx(calculateBankValue({ principal: 200000, annualRate: 0.02, selectedYear: 5 }), 200000 * 1.02 ** 5);
  assert.equal(calculateBankValue({ principal: 200000, annualRate: null, selectedYear: 5 }), 200000);
});

test('annual contributions use end-of-year timing', () => {
  approx(futureValueWithEndOfYearContributions({ annualContribution: 100000, annualRate: 0.05, projectionYears: 5 }), 552563.125);
  assert.notEqual(Math.round(futureValueWithEndOfYearContributions({ annualContribution: 100000, annualRate: 0.05, projectionYears: 5 })), 580191);
  approx(futureValueWithEndOfYearContributions({ annualContribution: 100000, annualRate: 0.05, projectionYears: 10 }), 552563.125 * 1.05 ** 5);
});

test('fixed deposits mature once and remain flat', () => {
  const maturity = calculateFixedDepositValue({ principal: 300000, termYears: 2, annualRate: 0.035, selectedYear: 2 });
  approx(calculateFixedDepositValue({ principal: 300000, termYears: 2, annualRate: 0.035, selectedYear: 1 }), 300000 * 1.035);
  approx(maturity, 300000 * 1.035 ** 2);
  approx(calculateFixedDepositValue({ principal: 300000, termYears: 2, annualRate: 0.035, selectedYear: 5 }), maturity);
  const total = currentPath({ method: 'fixed_deposit', amount: 100000, projectionYears: 5, assumptions: { fixedDeposits: [{ id: 'one', principal: 200000, termYears: 2, annualRate: 3 }, { id: 'two', principal: 300000, termYears: 1, annualRate: 3.5 }] } });
  approx(total.value, 200000 * 1.03 ** 2 + 300000 * 1.035);
});

test('bonds use simple coupon accumulation and stop at maturity', () => {
  approx(calculateBondValue({ principal: 300000, termYears: 5, annualRate: 0.04, selectedYear: 3 }), 336000);
  approx(calculateBondValue({ principal: 300000, termYears: 5, annualRate: 0.04, selectedYear: 5 }), 360000);
  approx(calculateBondValue({ principal: 300000, termYears: 5, annualRate: 0.04, selectedYear: 10 }), 360000);
  const total = currentPath({ method: 'bond', amount: 100000, projectionYears: 10, assumptions: { bonds: [{ id: 'one', principal: 200000, termYears: 2, annualRate: 3 }, { id: 'two', principal: 300000, termYears: 5, annualRate: 4 }] } });
  approx(total.value, 200000 * 1.06 + 300000 * 1.2);
});

test('P4 uses the same selected horizon for current method and Saving', () => {
  const session = { annualContribution: 100000, currentMethod: 'cash', assumptions: { existingDeposit: 200000, cashRate: 2 }, savingPhases: [{ id: 1, annualContribution: 100000 }] };
  for (const year of [8, 10, 15]) {
    const current = currentPath({ method: 'cash', amount: session.annualContribution, assumptions: session.assumptions, projectionYears: year });
    const saving = calculateSavingPortfolio({ session, overallPolicyYear: year, official });
    assert.equal(saving.policyYear, year);
    assert.equal(current.breakdown.existingDepositFutureValue, calculateBankValue({ principal: 200000, annualRate: 0.02, selectedYear: year }));
  }
});

test('three Saving phases keep independent contribution bases through P6/P7', () => {
  const session = { annualContribution: 100000, savingPhases: [
    { id: 1, annualContribution: 100000, strategyCode: 'withdraw7_from8', withdrawalPolicyYear: 8 },
    { id: 2, annualContribution: 80000, strategyCode: 'withdraw7_from8', withdrawalPolicyYear: 8 },
    { id: 3, annualContribution: 120000, strategyCode: 'withdraw7_from8', withdrawalPolicyYear: 8 }
  ]};
  const portfolio = calculateSavingPortfolio({ session, overallPolicyYear: 15, official });
  assert.deepEqual(portfolio.phases.map(phase => phase.totalContribution), [500000, 400000, 600000]);
  assert.equal(portfolio.plannedContribution, 1500000);
  const withdrawal = withdrawalPortfolio(session, official);
  assert.deepEqual(withdrawal.phases.map(phase => phase.result.totalContribution), [500000, 400000, 600000]);
  assert.equal(withdrawal.result.totalContribution, 1500000);
});

test('legacy phase and holding state falls back safely', () => {
  const legacy = { annualContribution: 100000, savingPhases: [{ id: 1 }], assumptions: { currentRate: 3.5 } };
  const result = calculateSavingPortfolio({ session: legacy, overallPolicyYear: 5, official });
  assert.equal(result.phases[0].annualContribution, 100000);
  const oldPath = currentPath({ method: 'fixed_deposit', amount: 100000, assumptions: { currentRate: 3.5 }, projectionYears: 5 });
  assert.equal(typeof oldPath.value, 'number');
});

test('none strategy never accumulates withdrawals', () => {
  const session = { annualContribution: 100000, savingPhases: [{ id: 1, annualContribution: 100000, strategyCode: 'none' }] };
  const result = withdrawalPortfolio(session, official);
  assert.equal(result.phases[0].result.cumulativeUsed, 0);
});
