"""Runtime product-state, exact-row aggregation and real render regressions."""
import subprocess

script = r'''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeSavingPhases, calculateSavingPortfolio, calculateOfficial, withdrawalPortfolio, currentPath} from './src/calculation.js';
import {createState, activateSavingPhase, removeSavingPhase, selectPhaseWithdrawal, selectPhaseWithdrawalYear, goTo, goBack} from './src/state.js';
import {render} from './src/views.js';
import {normalize} from './src/data.js';
const codes = ['withdraw7_from8','withdraw12_from15','withdraw18_from20','withdraw23_from25','withdraw29_from30'];
const starts = [8,15,20,25,30];
// Synthetic fixtures verify mechanics only; these are never genuine product values.
const rows = items => items.map(([policy_year,multiplier,withdrawal_rate=0])=>({policy_year,multiplier,withdrawal_rate}));
const official = {
 flow:['P4','P5','P6','P7'].map(page_id=>({page_id,title:page_id,subtitle:''})),
 current_methods:[],
 strategies:codes.map((strategy_code,i)=>({strategy_code,start_year:starts[i],display_name:'test',sheet_name:strategy_code,withdraw_rate:[.07,.12,.18,.23,.29][i]})),
 return_tables:{
  none:rows([[8,1.2],[10,1.4],[13,1.6],[15,1.8],[18,2],[20,2.2],[25,2.7],[30,3.2]]),
  [codes[0]]:rows([[8,1.1,.07],[10,1.3,.07],[13,1.5,.07],[15,1.7,.07],[18,1.9,.07],[20,2.1,.07],[25,2.6,.07],[30,3.1,.07]]),
  [codes[1]]:rows([[8,1.2],[10,1.4],[13,1.6],[15,1.7,.12],[18,1.9,.12],[20,2.1,.12],[25,2.6,.12],[30,3.1,.12],[40,4.1,.12]]),
  [codes[2]]:rows([[8,1.2],[10,1.4],[13,1.6],[15,1.8],[18,2],[20,2,.18],[25,2.5,.18],[30,3,.18]]),
  [codes[3]]:rows([[8,1.2],[15,1.8],[20,2.2],[25,2.5,.23],[30,3,.23]]),
  [codes[4]]:rows([[8,1.2],[15,1.8],[20,2.2],[25,2.7],[30,3,.29]])
 }
};
const state=createState({currentAge:40});
state.session.annualContribution=1000; state.session.currentMethod='cash';
assert.deepEqual(activeSavingPhases(state.session).map(p=>p.id),[1]);
const legacy={annualContribution:1000,withdrawalStrategyCode:codes[1],withdrawalPolicyYear:20};
assert.deepEqual(activeSavingPhases(legacy).map(p=>[p.id,p.strategyCode]),[[1,codes[1]]]);
assert.equal(withdrawalPortfolio(legacy,official).phases[0].selectedYear,20);
assert.equal(withdrawalPortfolio({...legacy,savingPhases:[{id:1,strategyCode:codes[0],withdrawalPolicyYear:25}],withdrawalOverallYear:30},official).phases[0].selectedYear,25);
assert.equal(withdrawalPortfolio({...legacy,savingPhases:[{id:1,strategyCode:codes[1]}]},official).phases[0].selectedYear,20);
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
assert.equal(calc(8).available,true); assert.equal(calc(8).futureValue,6000); assert.equal(calc(8).complete,false); assert.equal(calc(8).availablePhaseCount,1); assert.equal(calc(8).totalContribution,8000);
assert.equal(calc(8).phases[1].localPolicyYear,3); assert.equal(calc(8).phases[1].futureValue,undefined);
activateSavingPhase(state.session); activateSavingPhase(state.session);
assert.deepEqual(activeSavingPhases(state.session).map(p=>p.offset),[0,5,10]);
page=html('P5'); assert.match(page,/第三期 Saving/); assert.match(page,/第 11–15 年/); assert.doesNotMatch(page,/data-action="add-saving-phase"/);
assert.equal(calc(15).available,true); assert.equal(calc(15).remainingValue,16000); assert.equal(calc(15).complete,false);
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
selectPhaseWithdrawalYear(state.session,1,40,official);
selectPhaseWithdrawalYear(state.session,2,25,official);
selectPhaseWithdrawalYear(state.session,3,30,official);
state.session.withdrawalOverallYear=15; // obsolete shared state cannot override independent choices
let portfolio=withdrawalPortfolio(state.session,official);
assert.deepEqual(portfolio.phases.map(p=>p.offset+p.startYear),[15,13,30]);
assert.deepEqual(portfolio.phases.map(p=>p.selectedYear),[40,25,30]);
assert.deepEqual(portfolio.phases.map(p=>p.overallPolicyYear),[40,30,40]);
const expected=portfolio.phases.map(p=>calculateOfficial({annualContribution:1000,policyYear:p.selectedYear,strategyCode:p.strategyCode,official}));
for (const key of ['annualUsable','cumulativeUsed','remainingValue']) assert.equal(portfolio.result[key],expected.reduce((sum,p)=>sum+p[key],0));
assert.equal(portfolio.phases[0].result.cumulativeUsed,15600); // 26 annual withdrawals: years 15 through 40 inclusive
assert.equal(portfolio.result.remainingValue,48500);
assert.notEqual(portfolio.result.remainingValue,48500-portfolio.result.cumulativeUsed);
const independent=structuredClone(state.session.savingPhases);
selectPhaseWithdrawal(state.session,2,codes[1],official);
assert.deepEqual(state.session.savingPhases[0],independent[0]); assert.deepEqual(state.session.savingPhases[2],independent[2]);
assert.equal(state.session.savingPhases[1].withdrawalPolicyYear,15);
selectPhaseWithdrawalYear(state.session,2,30,official);
assert.deepEqual(state.session.savingPhases[0],independent[0]); assert.deepEqual(state.session.savingPhases[2],independent[2]);
state.session.savingPhases=independent;
page=html('P7');
assert.equal((page.match(/data-withdrawal-phase=/g)||[]).length,3);
for (const suffix of ['', '-2', '-3']) {
 assert.equal((page.match(new RegExp(`id="withdrawal-start-rail${suffix}"`,'g'))||[]).length,1);
 assert.equal((page.match(new RegExp(`id="withdrawal-explore-rail${suffix}"`,'g'))||[]).length,1);
}
assert.equal((page.match(/data-phase-metric=/g)||[]).length,9);
for(const [id,local] of [[1,40],[2,25],[3,30]]) assert.match(page,new RegExp(`aria-selected="true" data-action="select-withdrawal-year" data-value="${local}" data-phase-id="${id}"`));
assert.equal((page.match(/class="withdrawal-summary"/g)||[]).length,1);
assert.match(page,/按以上各期目前選擇合計/);
assert.doesNotMatch(page,/class="result-card"|由 .* 開始 · .* 當時|整體效果 · .*歲/);
// Phase 2 local 25 is actual age 40 + offset 5 + 25 = 70.
assert.match(page,/data-action="select-withdrawal-year" data-value="25" data-phase-id="2"><strong>70歲<\/strong><small>第 25年/);
for(const label of ['合計每年可使用','合計累積已使用','合計戶口價值']) assert.ok(page.includes(label));
const metricValues=value=>[...value.matchAll(/data-portfolio-metric="([^"]+)">([^<]+)</g)].map(m=>[m[1],m[2]]);
const metrics=metricValues(page);
state.customerView=true; const customerApp={innerHTML:''}; render(customerApp,state,official);
assert.deepEqual(metricValues(customerApp.innerHTML),metrics);
assert.match(customerApp.innerHTML,/HK\$ 48,500/);
for(const phase of portfolio.phases) assert.ok(customerApp.innerHTML.includes(`戶口 HK$ ${Math.round(phase.result.remainingValue).toLocaleString('en-US')}`));
for (const year of [40,25,30]) assert.ok(customerApp.innerHTML.includes(`探索第 ${year} 年`));
state.customerView=false;
state.session.savingPhases[1].withdrawalPolicyYear=26; // absent sparse row, never nearest substitution
portfolio=withdrawalPortfolio(state.session,official); assert.equal(portfolio.result.available,false);
assert.equal(portfolio.result.remainingValue,undefined); assert.equal(portfolio.phases[1].result.remainingValue,undefined);
page=html('P7'); assert.ok(metricValues(page).every(([,value])=>value==='—'));
assert.equal(portfolio.phases[0].selectedYear,40); assert.equal(portfolio.phases[2].selectedYear,30);
state.customerView=true; render(customerApp,state,official);
assert.deepEqual(metricValues(customerApp.innerHTML),metricValues(page)); state.customerView=false;
state.session.savingPhases=independent;
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
page=html('P7'); assert.doesNotMatch(page,/withdrawal-start-rail-2|withdrawal-start-rail-3|withdrawal-explore-rail-2|withdrawal-explore-rail-3/);
const single=withdrawalPortfolio(state.session,official); assert.equal(single.result.remainingValue,single.phases[0].result.remainingValue);
const before=structuredClone(state.session); selectPhaseWithdrawal(state.session,3,codes[1],official); assert.deepEqual(state.session,before);
// Genuine archive: verify the stated complete/incomplete examples, never synthetic product claims.
const evidence=JSON.parse(readFileSync('research/evidence/official-return-audit-2026-10-01.json','utf8'));
const genuine=normalize({data:{return_tables:evidence.return_tables,withdrawal_strategies:evidence.withdrawal_strategies}});
activateSavingPhase(state.session); activateSavingPhase(state.session);
for (const [overall, locals, count] of [[8,[8,3,-2],1],[13,[13,8,3],2],[18,[18,13,8],3]]) {
 const result=calculateSavingPortfolio({session:state.session,overallPolicyYear:overall,official:genuine});
 assert.equal(result.available,true); assert.equal(result.availablePhaseCount,count);
 assert.deepEqual(result.phases.map(p=>p.localPolicyYear),locals);
 const values=locals.filter(y=>y>=8).map(policyYear=>calculateOfficial({annualContribution:1000,policyYear,official:genuine}).futureValue);
 assert.equal(result.futureValue,values.reduce((sum,v)=>sum+v,0));
 assert.equal(result.complete,count===3);
 for(const phase of result.phases.filter(p=>p.started && !p.available)) assert.equal(phase.futureValue,undefined);
 state.session.policyYear=overall;
 const app={innerHTML:''}; state.pageId='P6'; render(app,state,{...genuine,flow:official.flow});
 assert.ok(app.innerHTML.includes(`目前已包括 ${count} 期可顯示價值`));
 assert.ok(app.innerHTML.includes(`HK$ ${Math.round(result.futureValue).toLocaleString('en-US')}`));
 state.pageId='P4'; render(app,state,{...genuine,flow:official.flow});
 assert.ok(app.innerHTML.includes(`HK$ ${Math.round(result.futureValue).toLocaleString('en-US')}`));
}
state.session.savingPhases=[{id:1,strategyCode:codes[1],withdrawalPolicyYear:40},{id:2,strategyCode:codes[0],withdrawalPolicyYear:25},{id:3,strategyCode:codes[2],withdrawalPolicyYear:30}];
const genuineWithdrawals=withdrawalPortfolio(state.session,genuine);
assert.equal(genuineWithdrawals.result.available,true);
for(const key of ['annualUsable','cumulativeUsed','remainingValue']) {
 const expected=genuineWithdrawals.phases.map(p=>calculateOfficial({annualContribution:1000,policyYear:p.selectedYear,strategyCode:p.strategyCode,official:genuine}));
 assert.equal(genuineWithdrawals.result[key],expected.reduce((sum,p)=>sum+p[key],0));
}
const unavailable=calculateSavingPortfolio({session:state.session,overallPolicyYear:3,official:genuine});
assert.equal(unavailable.available,false); assert.equal(unavailable.futureValue,undefined);
console.log('Multi-phase runtime: progressive genuine 8/13/18, independent strategies/times/results, summary, legacy and Customer View passed');
'''
subprocess.run(['node','--input-type=module','-e',script],check=True)
