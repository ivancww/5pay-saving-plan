"""Exercise the scenario routing, rendered interactions and Official boundary."""
from pathlib import Path
import subprocess

script = r'''
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, applyLocalOverrides } from './src/data.js';
import { calculateOfficial } from './src/calculation.js';
import { createState, goTo, goBack, getCustomerAge } from './src/state.js';
import { render } from './src/views.js';
import { INVESTMENT_TOOLS, SCENARIO_GOALS, investmentPath, scenarioRoute, toggleChoice } from './src/scenario-flow.js';

const evidence = JSON.parse(readFileSync('research/evidence/official-return-audit-2026-10-01.json','utf8'));
const official = normalize({data:{
  flow:['P1','P2','P3','P4','P5','P6','P7'].map((page_id,index)=>({page_id,order:index+1,title:page_id,subtitle:'',enabled:true})),
  page_content:[
    {page_id:'P1',content_id:'method-none',action_key:'none',headline:'未有安排',subtext:'',order:1,enabled:true},
    {page_id:'P2',content_id:'purpose-future',action_key:'future',headline:'未來需要',subtext:'',order:1,enabled:true}
  ],
  current_methods:[{method_key:'none',display_name:'未有安排'}],
  routing:[], return_tables:evidence.return_tables, withdrawal_strategies:evidence.withdrawal_strategies
}});
const effective=applyLocalOverrides(official,{});
const html=(state,page,source=effective)=>{state.pageId=page;const app={innerHTML:''};render(app,state,source);return app.innerHTML;};
const count=(text,pattern)=>(text.match(pattern)||[]).length;

assert.equal(getCustomerAge(createState()),null);
assert.deepEqual(['scenario1','scenario2','scenario3'].map(key=>scenarioRoute(official,key)),['P1','S2_TOOLS','S3_GOALS']);
const start=createState();
assert.equal(count(html(start,'START'),/data-action="select-scenario"/g),3);
assert.match(html(start,'P1'),/data-action="select-method"/);
start.pageId='START';
goTo(start,'P1');assert.equal(goBack(start),'START');
start.session.scenario='scenario1';start.session.currentMethod='none';start.session.annualContribution=50000;start.session.currentAge=40;
assert.match(html(start,'P3'),/5年後現有方法預計有幾多/);
assert.match(html(start,'P4'),/同一筆每年安排/);

assert.deepEqual(INVESTMENT_TOOLS.map(item=>item[1]),['定期存款','股票','ETF','債券']);
const s2=createState();s2.session.scenario='scenario2';
assert.equal(count(html(s2,'S2_TOOLS'),/data-action="toggle-investment-tool"/g),4);
assert.match(html(s2,'S2_TOOLS'),/data-action="continue-investment-tools"[^>]*disabled/);
for(const [tool,expected] of [['stock','S2_MARKET'],['etf','S2_MARKET'],['fixed_deposit','S2_MATURITY'],['bond','S2_MATURITY']]){
  s2.session.investmentTools=[tool];
  assert.equal(investmentPath(s2.session.investmentTools),expected);
  const page=html(s2,expected);
  assert.match(page,new RegExp(INVESTMENT_TOOLS.find(item=>item[0]===tool)[1]));
  if(expected==='S2_MARKET'){
    assert.match(page,/100、112、125、103、94、108/);
    assert.equal(count(page,/data-action="select-market-response"/g),3);
    assert.doesNotMatch(page,/data-action="continue-to-saving"/);
    s2.session.marketResponse='hold';
    assert.match(html(s2,expected),/data-action="continue-to-saving"/);
    s2.session.marketResponse=null;
  }else{
    assert.equal(count(page,/data-action="select-maturity-response"/g),4);
    if(tool==='bond') { assert.match(page,/如果債券有到期日/); assert.doesNotMatch(page,/>續期</); }
    if(tool==='fixed_deposit') assert.match(page,/>續期</);
    assert.doesNotMatch(page,/class="horizon-line"/);
    s2.session.maturityResponse='renew';
    assert.match(html(s2,expected),/第15年/);
    assert.match(html(s2,expected),/data-action="continue-to-saving"/);
    s2.session.maturityResponse=null;
  }
}
for(const selected of [['stock','fixed_deposit'],['etf','bond'],['stock','etf','fixed_deposit']]){
  s2.session.investmentTools=selected;
  assert.equal(investmentPath(selected),'S2_MIXED');
  s2.session.marketResponse=null;s2.session.maturityResponse=null;
  let page=html(s2,'S2_MARKET');
  assert.doesNotMatch(page,/data-action="continue-market-to-maturity"/);
  assert.doesNotMatch(page,/data-action="continue-to-saving"/);
  s2.session.marketResponse='hold';
  page=html(s2,'S2_MARKET');
  assert.match(page,/data-action="continue-market-to-maturity"/);
  s2.session.maturityResponse=null;
  page=html(s2,'S2_MATURITY');
  assert.equal(count(page,/data-action="select-maturity-response"/g),4);
  assert.doesNotMatch(page,/data-action="continue-maturity-to-mixed"/);
  s2.session.maturityResponse='compare';
  page=html(s2,'S2_MATURITY');
  assert.match(page,/data-action="continue-maturity-to-mixed"/);
  page=html(s2,'S2_MIXED');
  assert.equal(count(page,/data-action="select-mixed-focus"/g),2);
  for(const key of selected) assert.match(page,new RegExp(INVESTMENT_TOOLS.find(item=>item[0]===key)[1]));
  assert.match(page,/data-action="continue-to-saving"/);
}
const mixedBack=createState();
mixedBack.session.scenario='scenario2';mixedBack.session.investmentTools=['stock','fixed_deposit'];mixedBack.session.marketResponse='hold';mixedBack.session.maturityResponse='compare';
mixedBack.pageId='S2_TOOLS';goTo(mixedBack,'S2_MARKET');goTo(mixedBack,'S2_MATURITY');goTo(mixedBack,'S2_MIXED');
assert.equal(goBack(mixedBack),'S2_MATURITY');assert.match(html(mixedBack,'S2_MATURITY'),/data-value="compare"[^>]+aria-pressed="true"/);
assert.equal(goBack(mixedBack),'S2_MARKET');assert.match(html(mixedBack,'S2_MARKET'),/data-value="hold"[^>]+aria-pressed="true"/);
assert.equal(goBack(mixedBack),'S2_TOOLS');mixedBack.session.investmentTools=['stock'];
assert.equal(investmentPath(mixedBack.session.investmentTools),'S2_MARKET');
assert.match(html(mixedBack,'S2_MARKET'),/data-action="continue-to-saving"/);
assert.deepEqual(toggleChoice(['stock'],'stock',INVESTMENT_TOOLS),[]);
assert.deepEqual(toggleChoice([],'cash',INVESTMENT_TOOLS),[]);

const s3=createState();s3.session.scenario='scenario3';
assert.doesNotMatch(html(s3,'S3_GOALS'),/data-action="toggle-investment-tool"/);
assert.equal(count(html(s3,'S3_GOALS'),/data-action="toggle-goal"/g),3);
const combinations=[['stability'],['flexibility'],['growth'],['stability','flexibility'],['stability','growth'],['flexibility','growth'],['stability','flexibility','growth']];
const explanations=new Set();
for(const selected of combinations){
  s3.session.scenarioGoals=selected;
  const triangle=html(s3,'S3_GOALS');
  assert.equal(count(triangle,/goal-point [^"<]*is-selected/g),selected.length);
  assert.match(triangle,new RegExp(`data-selected-count="${selected.length}"`));
  const page=html(s3,'S3_TRADEOFF');
  assert.equal(count(page,/class="tradeoff-node is-selected"/g),selected.length);
  assert.match(page,/data-action="continue-to-saving"/);
  for(const [key,label] of SCENARIO_GOALS){
    if(selected.includes(key)) assert.match(page,new RegExp(label));
    else assert.doesNotMatch(page,new RegExp(label));
  }
  const message=page.match(/class="tradeoff-line" role="status">([^<]+)/)?.[1];
  assert.ok(message);explanations.add(message);
}
assert.equal(explanations.size,7);
assert.match(html(s3,'S3_TRADEOFF'),/難以同時最大化/);
assert.doesNotMatch(html(s3,'S3_TRADEOFF'),/★|⭐|3 stars|評分：\d/);

for(const state of [s2,s3]){
  state.session.annualContribution=50000;state.session.currentAge=40;
  assert.equal(scenarioRoute(official,'scenario_to_saving'),'P2');
  assert.match(html(state,'P2'),/data-action="select-purpose"/);
  assert.match(html(state,'P2'),/你希望呢筆錢將來用喺邊/);
  assert.doesNotMatch(html(state,'P3'),/data-assumption=/);
  assert.match(html(state,'P3'),/如果另外建立一筆 Saving/);
  assert.match(html(state,'P4'),/按官方已知數據/);
  assert.doesNotMatch(html(state,'P4'),/data-action="select-mixed-focus"/);
  assert.match(html(state,'P5'),/data-action="add-saving-phase"/);
  assert.match(html(state,'P6'),/accumulation-time-rail/);
  assert.match(html(state,'P7'),/withdrawal-start-rail/);
  state.customerView=true;
  assert.match(html(state,'P7'),/data-action="print"/);
  state.customerView=false;
}
const officialBefore=calculateOfficial({annualContribution:50000,policyYear:15,strategyCode:'none',official});
s2.session.investmentTools=['stock'];s2.session.marketResponse='reduce';
s3.session.scenarioGoals=['stability','growth'];
assert.deepEqual(calculateOfficial({annualContribution:50000,policyYear:15,strategyCode:'none',official}),officialBefore);
assert.equal(officialBefore.available,true);
assert.equal(official.return_tables[official.strategyMap.none].some(row=>row.multiplier===125),false);

// Configured routing uses the current routing domain only for valid stage targets.
official.routing=[{route_id:'scenario2',next_page:'S2_TOOLS',enabled:true},{route_id:'scenario_to_saving',next_page:'P7',enabled:true}];
assert.equal(scenarioRoute(official,'scenario2'),'S2_TOOLS');
assert.equal(scenarioRoute(official,'scenario_to_saving'),'P2');
const local=applyLocalOverrides(official,{pages:{S3_GOALS:{title:'本機標題'}},cards:{'method-none':{headline:'本機選項'}}});
assert.equal(local.flow.find(p=>p.page_id==='S3_GOALS').title,'本機標題');
assert.equal(local.page_content.find(p=>p.content_id==='method-none').headline,'本機選項');
assert.equal(official.flow.some(p=>p.page_id==='S3_GOALS'),false);
const overridden=applyLocalOverrides(official,{pages:{P2:{title:'本機目的標題'}}});
const app={innerHTML:''};s3.pageId='P2';render(app,s3,overridden,{pages:{P2:{title:'本機目的標題'}}});
assert.match(app.innerHTML,/本機目的標題/);
console.log('Scenario routing, four tools, all market/maturity/mixed paths, seven triangle states, convergence and Official boundary passed');
'''

result = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, text=True)
assert result.returncode == 0, result.stderr
print(result.stdout.strip())

main = Path('src/main.js').read_text()
assert "action === 'select-scenario'" in main
assert "action === 'toggle-investment-tool'" in main
assert "action === 'toggle-goal'" in main
assert "action === 'continue-to-saving'" in main
assert "if (p3Editing) { updateP3Live(); return; }" in main
assert "navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })" in main
