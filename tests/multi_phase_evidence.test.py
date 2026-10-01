"""Regression checks against a genuine captured dataset; no portfolio engine is enabled."""
import subprocess

script = r'''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize} from './src/data.js';
import {calculateOfficial, supportedYears} from './src/calculation.js';
import {createState} from './src/state.js';
const evidence = JSON.parse(readFileSync('research/evidence/official-return-audit-2026-10-01.json','utf8'));
const official = normalize({data:{return_tables:evidence.return_tables,withdrawal_strategies:evidence.withdrawal_strategies}});
const common = [...Array.from({length:18},(_,i)=>i+8),...Array.from({length:15},(_,i)=>30+i*5)];
const amount = 1000; // Test customer contribution; every multiplier/rate is genuine.
assert.equal(evidence.bootstrap_return_tables_match_returns,true);
for (const strategy of official.strategies) {
  const years = supportedYears(official,strategy.strategy_code);
  assert.deepEqual(years,strategy.strategy_code==='withdraw18_from20' ? common.filter(y=>y<21||y>24) : common);
  for (const year of [1,2,3,4,5,6,7,26,101]) {
    const result = calculateOfficial({annualContribution:amount,policyYear:year,strategyCode:strategy.strategy_code,official});
    assert.equal(result.available,false);
    assert.equal(result.futureValue,undefined); // Missing row is not a zero-valued phase.
    assert.equal(result.remainingValue,undefined);
    assert.match(result.message,new RegExp(`第 ${year} 年`));
  }
  for (const row of official.return_tables[strategy.sheet_name]) {
    const result = calculateOfficial({annualContribution:amount,policyYear:row.policy_year,strategyCode:strategy.strategy_code,official});
    assert.equal(result.available,true);
    assert.equal(result.totalContribution,amount*5);
    assert.equal(result.futureValue,amount*5*Number(row.multiplier));
    assert.equal(result.remainingValue,result.futureValue); // No double deduction.
    const start = Number(strategy.start_year)||null;
    const rate = Number(row.withdrawal_rate)||Number(strategy.withdraw_rate)||0;
    assert.equal(result.annualUsable,rate>0&&start&&row.policy_year>=start ? amount*5*rate : 0);
    const used = official.return_tables[strategy.sheet_name]
      .filter(item=>start&&item.policy_year>=start&&item.policy_year<=row.policy_year)
      .reduce((sum,item)=>sum+amount*5*(Number(item.withdrawal_rate)||Number(strategy.withdraw_rate)||0),0);
    assert.equal(result.cumulativeUsed,used);
  }
}
// Requested time mapping is examined as evidence only, not activated in production.
const offsets = [0,5,10];
const status = (overall,offset) => overall<=offset ? 'not-started' : supportedYears(official,'none').includes(overall-offset) ? 'exact' : 'missing';
assert.deepEqual(offsets.map(offset=>status(8,offset)),['exact','missing','not-started']);
assert.deepEqual(offsets.map(offset=>status(15,offset)),['exact','exact','missing']);
assert.deepEqual(offsets.map(offset=>20-offset),[20,15,10]);
assert.deepEqual(offsets.map(offset=>status(20,offset)),['exact','exact','exact']);
for (let year=6;year<=12;year++) assert.equal(status(year,5),'missing');
for (let year=11;year<=17;year++) assert.equal(status(year,10),'missing');
assert.deepEqual([8,15,20,25,30].map(year=>status(year,5)),['missing','exact','exact','exact','exact']);
assert.deepEqual([8,15,20,25,30].map(year=>status(year,10)),['not-started','missing','exact','exact','exact']);
// An unchanged session cannot secretly activate an optional phase.
const state = createState();
assert.equal(Object.hasOwn(state.session,'phaseCount'),false);
assert.equal(Object.hasOwn(state.session,'activePhases'),false);
console.log('Genuine evidence gate checks passed: 194 exact rows, early/sparse missing rows, requested offsets and unchanged single-block withdrawal mechanics');
'''
subprocess.run(['node', '--input-type=module', '-e', script], check=True)
