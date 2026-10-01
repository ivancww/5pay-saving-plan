"""Runtime product-state, exact-row aggregation and real render regressions."""
import subprocess

script = r'''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeSavingPhases, calculateSavingPortfolio, calculateOfficial, withdrawalPortfolio, currentPath} from './src/calculation.js';
import {createState, activateSavingPhase, removeSavingPhase, selectPhaseWithdrawal, goTo, goBack} from './src/state.js';
import {render} from './src/views.js';
import {normalize} from './src/data.js';
const codes = ['withdraw7_from8','withdraw12_from15','withdraw18_from20','withdraw23_from25','withdraw29_from30'];
const starts = [8,15,20,25,30];
// Synthetic fixtures verify mechanics only; these are never genuine product values.
const rows = items => items.map(([policy_year,multiplier,withdrawal_rate=0])=>({policy_year,multiplier,withdrawal_rate}));
const official = {
 flow:['P4','P5','P6','P7'].map(page_id=>({page_id,title:page_id,subtitle:''})),
 current_methods:[],
 strategies:codes.map((strategy_code,i)=>({strategy_code,start_year:starts[i],display_name:'test',sheet_name:strategy_code,withdraw_rate:0})),
 return_tables:{
  none:rows([[8,1.2],[10,1.4],[13,1.6],[15,1.8],[18,2],[20,2.2],[25,2.7],[30,3.2]]),
  [codes[0]]:rows([[8,1.1,.02],[10,1.3,.03],[13,1.5,.04],[15,1.7,.05],[18,1.9,.08],[20,2.1,.07],[25,2.6,.1],[30,3.1,.06]]),
  [codes[1]]:rows([[8,1.2],[10,1.4],[13,1.6],[15,1.7,.05],[18,1.9,.08],[20,2.1,.07],[25,2.6,.1],[30,3.1,.06]]),
  [codes[2]]:rows([[8,1.2],[10,1.4],[13,1.6],[15,1.8],[18,2],[20,2,.09],[25,2.5,.1],[30,3,.12]]),
  [codes[3]]:rows([[8,1.2],[15,1.8],[20,2.2],[25,2.5,.1],[30,3,.1]]),
  [codes[4]]:rows([[8,1.2],[15,1.8],[20,2.2],[25,2.7],[30,3,.12]])
 }
};
const state=createState({currentAge:40});
state.session.annualContribution=1000; state.session.currentMethod='cash';
assert.deepEqual(activeSavingPhases(state.session).map(p=>p.id),[1]);
const legacy={annualContribution:1000,withdrawalStrategyCode:codes[1],withdrawalPolicyYear:20};
assert.deepEqual(activeSavingPhases(legacy).map(p=>[p.id,p.strategyCode]),[[1,codes[1]]]);
assert.equal(withdrawalPortfolio(legacy,official).selectedYear,20);
assert.deepEqual(activeSavingPhases({savingPhases:[{id:3,strategyCode:codes[2]}]}).map(p=>p.id),[1]);
const html=page=>{state.pageId=page; const app={innerHTML:''}; render(app,state,official); return app.innerHTML;};
let page=html('P5'); assert.match(page,/第一期 Saving/); assert.doesNotMatch(page,/第二期 Saving|第三期 Saving/);
assert.match(page,/第 1–5 年/); assert.match(page,/HK\$ 5,000/);
const calc=year=>calculateSavingPortfolio({session:state.session,overallPolicyYear:year,official});
assert.equal(calc(20).futureValue,11000);
const currentBefore=currentPath({method:'cash',amount:1000,projectionYears:20});
activateSavingPhase(state.session); assert.deepEqual(activeSavingPhases(state.session).map(p=>p.offset),[0,5]);
page=html('P5'); assert.match(page,/第二期 Saving/); assert.doesNotMatch(page,/第三期 Saving/); assert.match(page,/第 6–10 年/);
assert.equal(calc(13).futureValue,14000);
assert.equal(calc(8).available,false); assert.equal(calc(8).futureValue,undefined); assert.equal(calc(8).totalContribution,8000);
assert.equal(calc(8).phases[1].localPolicyYear,3); assert.equal(calc(8).phases[1].futureValue,undefined);
activateSavingPhase(state.session); activateSavingPhase(state.session);
assert.deepEqual(activeSavingPhases(state.session).map(p=>p.offset),[0,5,10]);
page=html('P5'); assert.match(page,/第三期 Saving/); assert.match(page,/第 11–15 年/); assert.doesNotMatch(page,/data-action="add-saving-phase"/);
assert.equal(calc(15).available,false); assert.equal(calc(15).remainingValue,undefined);
assert.equal(calc(15).totalContribution,15000);
assert.equal(calc(18).futureValue,24000); assert.equal(calc(20).futureValue,27000);
assert.deepEqual(calc(20).phases.map(p=>p.localPolicyYear),[20,15,10]);
assert.equal(calc(8).phases[2].started,false);
state.session.policyYear=20;
page=html('P6'); assert.match(page,/HK\$ 27,000/); assert.match(page,/累積 Saving 價值/);
assert.doesNotMatch(page,/data-action="add-saving-phase"/);
// Return to P4 inherits P5 choices, while Current Method stays at five contributions.
goTo(state,'P4'); goTo(state,'P5'); goBack(state); page=html(state.pageId);
assert.equal(state.pageId,'P4'); assert.match(page,/HK\$ 27,000/); assert.match(page,/HK\$ 5,000/);
assert.deepEqual(currentPath({method:'cash',amount:1000,projectionYears:20}),currentBefore);
selectPhaseWithdrawal(state.session,1,codes[1],official);
selectPhaseWithdrawal(state.session,2,codes[0],official);
selectPhaseWithdrawal(state.session,3,codes[2],official);
assert.deepEqual(activeSavingPhases(state.session).map(p=>p.strategyCode),[codes[1],codes[0],codes[2]]);
assert.equal(state.session.withdrawalOverallYear,30);
let portfolio=withdrawalPortfolio(state.session,official);
assert.deepEqual(portfolio.phases.map(p=>p.offset+p.startYear),[15,13,30]);
assert.equal(portfolio.result.annualUsable,1250);
assert.equal(portfolio.result.cumulativeUsed,4200);
assert.equal(portfolio.result.remainingValue,38500);
assert.equal(portfolio.result.futureValue,38500);
assert.notEqual(portfolio.result.remainingValue,38500-4200);
page=html('P7');
assert.equal((page.match(/data-withdrawal-phase=/g)||[]).length,3);
assert.equal((page.match(/id="withdrawal-explore-rail"/g)||[]).length,1);
assert.match(page,/withdrawal-start-rail-2/); assert.match(page,/withdrawal-start-rail-3/);
assert.doesNotMatch(page,/class="result-card"|由 .* 開始 · .* 當時/);
for(const label of ['合計每年可使用','合計累積已使用','合計當時戶口價值']) assert.ok(page.includes(label));
const metricValues=value=>[...value.matchAll(/data-portfolio-metric="([^"]+)">([^<]+)</g)].map(m=>[m[1],m[2]]);
const metrics=metricValues(page);
state.customerView=true; const customerApp={innerHTML:''}; render(customerApp,state,official);
assert.deepEqual(metricValues(customerApp.innerHTML),metrics);
assert.match(customerApp.innerHTML,/HK\$ 38,500/); state.customerView=false;
state.session.withdrawalOverallYear=15;
portfolio=withdrawalPortfolio(state.session,official); assert.equal(portfolio.result.available,false);
assert.equal(portfolio.result.remainingValue,undefined);
page=html('P7'); assert.ok(metricValues(page).every(([,value])=>value==='—'));
state.customerView=true; render(customerApp,state,official);
assert.deepEqual(metricValues(customerApp.innerHTML),metricValues(page)); state.customerView=false;
// A not-started optional phase cannot block or contribute to the current value.
const early=structuredClone(official); early.return_tables.none=rows([[5,1],[8,1.2]]);
const atFive=calculateSavingPortfolio({session:state.session,overallPolicyYear:5,official:early});
assert.equal(atFive.available,true); assert.equal(atFive.remainingValue,5000);
assert.deepEqual(atFive.phases.map(p=>p.started),[true,false,false]);
removeSavingPhase(state.session,3); assert.equal(activeSavingPhases(state.session).length,2);
page=html('P7'); assert.doesNotMatch(page,/withdrawal-start-rail-3/);
activateSavingPhase(state.session); assert.equal(activeSavingPhases(state.session)[2].strategyCode,null);
removeSavingPhase(state.session,2); assert.equal(activeSavingPhases(state.session).length,1);
page=html('P5'); assert.doesNotMatch(page,/第二期 Saving|第三期 Saving/);
page=html('P7'); assert.doesNotMatch(page,/withdrawal-start-rail-2|withdrawal-start-rail-3/);
const before=structuredClone(state.session); selectPhaseWithdrawal(state.session,3,codes[1],official); assert.deepEqual(state.session,before);
// Genuine archive: verify the stated complete/incomplete examples, never synthetic product claims.
const evidence=JSON.parse(readFileSync('research/evidence/official-return-audit-2026-10-01.json','utf8'));
const genuine=normalize({data:{return_tables:evidence.return_tables,withdrawal_strategies:evidence.withdrawal_strategies}});
activateSavingPhase(state.session);
assert.equal(calculateSavingPortfolio({session:state.session,overallPolicyYear:8,official:genuine}).available,false);
assert.equal(calculateSavingPortfolio({session:state.session,overallPolicyYear:13,official:genuine}).available,true);
activateSavingPhase(state.session);
assert.equal(calculateSavingPortfolio({session:state.session,overallPolicyYear:15,official:genuine}).available,false);
assert.equal(calculateSavingPortfolio({session:state.session,overallPolicyYear:18,official:genuine}).available,true);
console.log('Multi-phase runtime: state/legacy, activation/removal, P4–P7, exact independent strategies, availability, contributions and Customer View passed');
'''
subprocess.run(['node','--input-type=module','-e',script],check=True)
