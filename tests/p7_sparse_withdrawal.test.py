"""P7 regression: annual withdrawals continue through sparse Official rows."""
import subprocess

script = r'''
import assert from 'node:assert/strict';
import {calculateOfficial, calculateCumulativeWithdrawal, aggregateWithdrawalResults} from './src/calculation.js';

const sparseRows = (rate, multiplierBase = 1) => [
  [8, 0], [15, 0], [20, 0], [23, 0], [24, 0], [25, rate],
  [30, rate], [35, rate], [40, rate]
].map(([policy_year, withdrawal_rate]) => ({policy_year, withdrawal_rate, multiplier: multiplierBase + policy_year / 100}));
const strategies = [
  ['withdraw7_from8', 8, .07, 8],
  ['withdraw12_from15', 15, .12, 15],
  ['withdraw18_from20', 20, .18, 20],
  ['withdraw23_from25', 25, .23, 25],
  ['withdraw29_from30', 30, .29, 30]
];
const official = {
  strategies: [
    {strategy_code:'none', start_year:'', withdraw_rate:0, sheet_name:'none'},
    ...strategies.map(([strategy_code, start_year, withdraw_rate]) => ({strategy_code, start_year, withdraw_rate, sheet_name:strategy_code}))
  ],
  strategyMap: {none:'none', ...Object.fromEntries(strategies.map(([code]) => [code, code]))},
  return_tables: {none:[{policy_year:30, multiplier:3}], ...Object.fromEntries(strategies.map(([code,,rate]) => [code, sparseRows(rate)]))}
};
const result = (policyYear, strategyCode='withdraw7_from8') => calculateOfficial({
  annualContribution: 1000, policyYear, strategyCode, official
});
const largeResult = (policyYear, strategyCode='withdraw7_from8') => calculateOfficial({
  annualContribution: 20000, policyYear, strategyCode, official
});

// Cases A-C and the mandatory later-year continuity check.
assert.equal(largeResult(25).annualUsable, 7000);
assert.equal(largeResult(25).cumulativeUsed, 126000);
assert.equal(largeResult(30).cumulativeUsed, 161000);
assert.equal(largeResult(30).cumulativeUsed - largeResult(25).cumulativeUsed, 35000);
assert.equal(largeResult(35).cumulativeUsed - largeResult(30).cumulativeUsed, 35000);
assert.equal(largeResult(40).cumulativeUsed - largeResult(35).cumulativeUsed, 35000);
assert.equal(calculateCumulativeWithdrawal({totalContribution:100000, startYear:8, selectedYear:25, annualRate:.07}),126000);
assert.equal(calculateCumulativeWithdrawal({totalContribution:100000, startYear:8, selectedYear:30, annualRate:.07}),161000);

// Case D: auto accumulation never creates withdrawals.
const auto = calculateOfficial({annualContribution:1000, policyYear:30, strategyCode:'none', official});
assert.equal(auto.annualUsable, 0); assert.equal(auto.cumulativeUsed, 0);

// Cases E-F: exact Official value is preserved; unsupported value is unavailable.
assert.equal(result(30).remainingValue, 5000 * 1.3);
assert.equal(result(30).remainingValue, result(30).futureValue);
assert.equal(result(27).available, false);
assert.equal(result(27).remainingValue, undefined);

// Case G and all configured strategies: each phase is independent and sums as-is.
for (const [code, start, rate] of strategies) {
  const selected = calculateOfficial({annualContribution:1000, policyYear:start + 10, strategyCode:code, official});
  assert.equal(selected.annualUsable, 5000 * rate);
  assert.equal(selected.cumulativeUsed, 5000 * rate * 11);
}
const phaseA = result(30);
const phaseB = calculateOfficial({annualContribution:1000, policyYear:35, strategyCode:'withdraw12_from15', official});
const aggregate = aggregateWithdrawalResults([
  {result:phaseA, offset:0, selectedYear:30},
  {result:phaseB, offset:5, selectedYear:35}
], 1000);
assert.equal(aggregate.cumulativeUsed, phaseA.cumulativeUsed + phaseB.cumulativeUsed);
assert.equal(aggregate.remainingValue, phaseA.remainingValue + phaseB.remainingValue);

console.log('P7 sparse annual withdrawal regression passed');
'''
subprocess.run(['node', '--input-type=module', '-e', script], check=True)
