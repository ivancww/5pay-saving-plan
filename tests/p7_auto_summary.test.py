"""Genuine exact-table auto/withdrawal choices and single/multi customer rendering."""
import subprocess

script = r'''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize} from './src/data.js';
import {calculateOfficial, phaseStrategyChoices, supportedYears, withdrawalPortfolio} from './src/calculation.js';
import {createState, activateSavingPhase, selectPhaseWithdrawal, selectPhaseWithdrawalYear} from './src/state.js';
import {render} from './src/views.js';
const evidence=JSON.parse(readFileSync('research/evidence/official-return-audit-2026-10-01.json','utf8'));
const official=normalize({data:{return_tables:evidence.return_tables,withdrawal_strategies:evidence.withdrawal_strategies}});
official.flow=['P5','P7'].map(page_id=>({page_id,title:page_id,subtitle:''}));
const codes=['none','withdraw7_from8','withdraw12_from15','withdraw18_from20','withdraw23_from25','withdraw29_from30'];
assert.deepEqual(phaseStrategyChoices(official).map(p=>p.strategy_code),codes);
const make=count=>{const s=createState({currentAge:40});s.session.annualContribution=50000;for(let i=1;i<count;i++)activateSavingPhase(s.session);return s;};
const html=(state,customer=false)=>{state.pageId='P7';state.customerView=customer;const app={innerHTML:''};render(app,state,official);return app.innerHTML;};
const count=(text,pattern)=>(text.match(pattern)||[]).length;
// Adding the explicit option must not change null/default or activate legacy phases.
assert.equal(withdrawalPortfolio(make(1).session,official).phases[0].strategyCode,codes[1]);
const legacy=withdrawalPortfolio({annualContribution:50000,withdrawalStrategyCode:'none',withdrawalPolicyYear:30},official);
assert.equal(legacy.phases.length,1);assert.equal(legacy.phases[0].strategyCode,'none');assert.equal(legacy.phases[0].selectedYear,30);
assert.equal(legacy.result.annualUsable,0);assert.equal(legacy.result.cumulativeUsed,0);
const absent=structuredClone(official);absent.return_tables[absent.strategyMap.none]=[];
assert.equal(phaseStrategyChoices(absent)[0].strategy_code,'none');
const absentState=make(1);selectPhaseWithdrawal(absentState.session,1,'none',absent);
assert.equal(withdrawalPortfolio(absentState.session,absent).phases[0].result.available,false);
const s=make(3);
// Every phase accepts all six choices and uses only that choice's exact rows.
for(const id of [1,2,3]) for(const code of codes) {
 const before=structuredClone(s.session.savingPhases.filter(p=>p.id!==id));
 selectPhaseWithdrawal(s.session,id,code,official);
 let p=withdrawalPortfolio(s.session,official).phases.find(p=>p.id===id);
 const eligible=supportedYears(official,code).filter(year=>code==='none'||year>=p.startYear);
 assert.deepEqual(p.years,eligible);assert.equal(p.selectedYear,eligible[0]);
 assert.equal(p.strategyCode,code);assert.equal(p.result.available,true);
 selectPhaseWithdrawalYear(s.session,id,30,official);
 p=withdrawalPortfolio(s.session,official).phases.find(p=>p.id===id);
 assert.equal(p.selectedYear,30);assert.equal(p.overallPolicyYear,30+(id-1)*5);
 const expected=calculateOfficial({annualContribution:50000,policyYear:30,strategyCode:code,official});
 assert.deepEqual(p.result,expected);
 assert.deepEqual(s.session.savingPhases.filter(p=>p.id!==id),before);
 if(code==='none') {assert.equal(p.result.annualUsable,0);assert.equal(p.result.cumulativeUsed,0);assert.equal(p.startYear,null);}
 const page=html(s);
 const phaseSection=page.split(`data-withdrawal-phase="${id}"`)[1].split('</section>')[0];
 assert.equal(count(phaseSection,/data-action="select-withdrawal-start"/g),6);
 const rail=phaseSection.split('class="timeline-rail"')[1].split('</div>')[0];
 assert.equal(count(rail,/aria-selected="true"/g),1); // none and year-8 must never both select
 assert.match(rail,new RegExp(`aria-selected="true"[^>]+data-strategy-code="${code}"`));
 if(code==='none') assert.match(phaseSection,/data-phase-metric="annualUsable">HK\$ 0</);
}
// Mixed independent scenarios: true zero withdrawal is available and included.
for(const [id,code,year] of [[1,'none',30],[2,codes[1],25],[3,codes[3],30]]) {
 selectPhaseWithdrawal(s.session,id,code,official);selectPhaseWithdrawalYear(s.session,id,year,official);
}
const mixed=withdrawalPortfolio(s.session,official);
assert.equal(mixed.result.available,true);assert.equal(mixed.phases[0].result.annualUsable,0);
for(const key of ['annualUsable','cumulativeUsed','remainingValue']) assert.equal(mixed.result[key],mixed.phases.reduce((sum,p)=>sum+p.result[key],0));
for(const p of mixed.phases) assert.equal(p.result.remainingValue,p.result.multiplier*250000); // no second deduction
assert.match(html(s),/data-value="25" data-phase-id="2"><strong>70歲<\/strong><small>第 25年/);
const customer=html(s,true);
assert.match(customer,/第一期：自動滾存/);assert.match(customer,/沒有提取 · 累積已使用 HK\$ 0/);
assert.match(customer,/探索第 30 年（70歲）/);
const metrics=text=>[...text.matchAll(/data-portfolio-metric="([^"]+)">([^<]+)</g)].map(m=>[m[1],m[2]]);
assert.deepEqual(metrics(customer),metrics(html(s)));
// Absent exact none row is still unavailable; genuine zero is a different state.
s.session.savingPhases[0].withdrawalPolicyYear=26;
const missing=withdrawalPortfolio(s.session,official);
assert.equal(missing.phases[0].result.available,false);assert.equal(missing.phases[0].result.remainingValue,undefined);
assert.equal(missing.result.available,false);assert.equal(missing.result.remainingValue,undefined);
assert.ok(metrics(html(s)).every(([,v])=>v==='—'));
// Single/multi summaries and individual contribution rows derive from customer input.
for(const n of [1,2,3]) for(const annual of [50000,12345]) {
 const state=make(n);state.session.annualContribution=annual;
 const page=html(state), report=html(state,true);
 assert.equal(count(page,/data-withdrawal-phase=/g),n);
 assert.equal(count(page,/data-phase-metric=/g),n*3);
 assert.equal(count(page,/class="withdrawal-summary"/g),n===1?0:1);
 assert.equal(count(report,/<h2>整體效果<\/h2>/g),n===1?0:1);
 assert.equal(metrics(page).length,n===1?0:3);assert.deepEqual(metrics(report),metrics(page));
 assert.equal(count(report,/data-contribution-phase=/g),n);
 assert.equal(count(report,/data-customer-withdrawal-phase=/g),n);
 const format=v=>`HK$ ${v.toLocaleString('en-US')}`;
 for(let id=1;id<=n;id++) {
  const row=report.split(`data-contribution-phase="${id}"`)[1].split('</div>')[0];
  assert.ok(row.includes(`每年 ${format(annual)} · 供款 5 年`));
  assert.ok(row.includes(`供款總額 ${format(annual*5)}`));
 }
 assert.equal(count(report,/class="customer-contribution-total"/g),n===1?0:1);
 if(n>1) assert.ok(report.includes(`<span>合計供款</span><strong>${format(annual*5*n)}</strong>`));
 assert.doesNotMatch(page,/class="result-card"|withdrawalOverallYear/);
 assert.match(report,/data-action="print"/);
}
console.log('Genuine auto accumulation: all 18 phase/choice combinations, exact zero/value, independent mixed summary, single/multi UI and dynamic contribution details passed');
'''
subprocess.run(['node','--input-type=module','-e',script],check=True)
