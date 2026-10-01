"""Execute the actual draw/render lifecycle without a browser dependency."""
from pathlib import Path
import subprocess

main = Path('src/main.js').read_text()
views = Path('src/views.js').read_text()
signature = 'function draw(focus = null, resetRails = [])'
draw = main.split(signature, 1)[1].split('function clone', 1)[0]
assert draw.index('rail.scrollLeft') < draw.index('render(app, state,')
assert draw.index('render(app, state,') < draw.index('rail.scrollLeft = previous.left')
assert 'navigator.userAgent' not in main + views
assert 'setTimeout' not in draw
assert 'scrollIntoView' not in draw
assert 'behavior:' not in draw
assert 'if (p3Editing) { updateP3Live(); return; }' in main
assert 'draw(' not in main.split("app.addEventListener('input'", 1)[1].split("app.addEventListener('click'", 1)[0]

script = r'''
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { render } from './src/views.js';
import { createState, selectPhaseWithdrawal, activateSavingPhase } from './src/state.js';

const main = readFileSync('src/main.js', 'utf8');
const signature = 'function draw(focus = null, resetRails = [])';
const drawSource = signature + main.split(signature)[1].split('function clone')[0];
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const state = createState({currentAge: 40});
state.session.currentMethod = 'cash';
state.session.annualContribution = 100000;
const points = [['withdraw7_from8',8], ['withdraw12_from15',15], ['withdraw18_from20',20], ['withdraw23_from25',25], ['withdraw29_from30',30]];
// Synthetic exact-row fixtures test UI behavior only, not genuine product values.
const years = [5,8,15,20,25,30,40,50];
const official = {
  flow: ['P4','P6','P7'].map(page_id => ({page_id,title:page_id,subtitle:''})),
  strategies: points.map(([strategy_code,start_year]) => ({strategy_code,start_year,display_name:strategy_code})),
  return_tables: Object.fromEntries(['none', ...points.map(p => p[0])].map(code => [code, years.map(policy_year => ({policy_year,multiplier:policy_year/10}))]))
};
let rails = [], html = '', reads = [], writes = 0, resetOffset = 0;
const app = {
  querySelectorAll: selector => { assert.equal(selector, '.timeline-rail[id]'); return rails; },
  set innerHTML(value) {
    // Every old rail was read before replacement, including both P7 controls.
    assert.deepEqual(reads, rails.map(rail => rail.id));
    writes++;
    html = value;
    rails = [...value.matchAll(/<div id="([^"]+)" class="timeline-rail" data-scroll-context="([^"]+)"/g)].map(([,id,context]) => {
      let left = 0;
      return {id,dataset:{scrollContext:decode(context)},firstElementChild:{offsetLeft:0},querySelector:()=>({offsetLeft:resetOffset}),get scrollLeft(){reads.push(id);return left;},set scrollLeft(value){left=value;},position:()=>left};
    });
    reads = [];
  }
};
const sandbox = {app,state,official,overrides:{},previewOverrides:null,meta:{},render,applyLocalOverrides:base=>base,entryMode:'standalone',ENTRY_MODES:{unsupported:'unsupported'},document:{getElementById:()=>null},selectPhaseWithdrawal};
vm.createContext(sandbox);
vm.runInContext(drawSource, sandbox);
const redraw = () => { reads = []; sandbox.draw(); };
const rail = id => rails.find(rail => rail.id === id);
for (const [page,id] of [['P4','comparison-time-rail'],['P6','accumulation-time-rail']]) {
  state.pageId = page; redraw();
  rail(id).scrollLeft = 423.5;
  const before = html;
  state.session.policyYear = 30; redraw();
  assert.equal(rail(id).position(),423.5);
  assert.notEqual(html,before); // selection and calculated result are re-rendered
  assert.match(html,/is-selected[^>]*data-value="30"/);
  redraw(); assert.equal(rail(id).position(),423.5); // non-click redraw too
  state.session.policyYear = 15;
}
state.pageId = 'P7'; redraw();
const start = 'withdrawal-start-rail', explore = 'withdrawal-explore-rail';
rail(start).scrollLeft = 201; rail(explore).scrollLeft = 517;
state.session.withdrawalOverallYear = 40; redraw();
assert.equal(rail(start).position(),201); assert.equal(rail(explore).position(),517);
assert.match(html,/is-selected[^>]*data-action="select-withdrawal-year" data-value="40"/);
// Execute the unchanged start-selection handler with real control values.
const startHandler = main.split("if (action === 'select-withdrawal-start') {")[1].split('\n  }')[0];
sandbox.control = {dataset:{strategyCode:'withdraw29_from30',value:'30'}};
vm.runInContext(startHandler,sandbox); redraw();
assert.equal(state.session.withdrawalOverallYear,30);
assert.equal(rail(start).position(),201); assert.equal(rail(explore).position(),0);
assert.match(html,/is-selected[^>]*data-action="select-withdrawal-year" data-value="30"/);
rail(explore).scrollLeft = 106; state.session.withdrawalOverallYear = 40; redraw();
assert.equal(rail(start).position(),201); assert.equal(rail(explore).position(),106);
// Reselecting the same start still resets the dependent year in the existing handler.
vm.runInContext(startHandler,sandbox);
const clickRedraw = main.match(/draw\(null, action === 'select-withdrawal-start'[^;]+;/)[0];
sandbox.action = 'select-withdrawal-start'; reads = [];
vm.runInContext(clickRedraw,sandbox);
assert.equal(state.session.withdrawalOverallYear,30);
assert.equal(rail(start).position(),201); assert.equal(rail(explore).position(),0);
activateSavingPhase(state.session); activateSavingPhase(state.session); redraw();
const start2 = 'withdrawal-start-rail-2', start3 = 'withdrawal-start-rail-3';
rail(start).scrollLeft = 201; rail(start2).scrollLeft = 102; rail(start3).scrollLeft = 203;
for (const [id, code] of [[2,'withdraw12_from15'], [3,'withdraw18_from20'], [1,'withdraw7_from8']]) {
  sandbox.control = {dataset:{phaseId:String(id),strategyCode:code}};
  vm.runInContext(startHandler,sandbox); reads = []; vm.runInContext(clickRedraw,sandbox);
  assert.equal(rail(start).position(),201); assert.equal(rail(start2).position(),102); assert.equal(rail(start3).position(),203);
  assert.equal(rail(explore).position(),0);
}
// A deliberate dependent reset can select a later overall point: align it once,
// while leaving all strategy rails at the user's positions.
resetOffset = 212;
sandbox.control = {dataset:{phaseId:'3',strategyCode:'withdraw18_from20'}};
vm.runInContext(startHandler,sandbox); reads = []; vm.runInContext(clickRedraw,sandbox);
assert.equal(rail(explore).position(),212);
assert.equal(rail(start).position(),201); assert.equal(rail(start2).position(),102); assert.equal(rail(start3).position(),203);
resetOffset = 0;
// Revisiting pages cannot recover a stale position from a previous visit.
state.pageId = 'P4'; redraw(); assert.equal(rail('comparison-time-rail').position(),0);
state.pageId = 'P7'; redraw(); assert.equal(rail(start).position(),0);
rail(start).scrollLeft = 200; state.customerView = true; redraw();
assert.equal(rails.length,0); state.customerView = false; redraw(); assert.equal(rail(start).position(),0);
// Changed baseline/options are a new timeline; same selection is not.
rail(start).scrollLeft = 200; state.session.currentAge = 45; redraw(); assert.equal(rail(start).position(),0);
state.pageId = 'P6'; redraw(); rail('accumulation-time-rail').scrollLeft = 300;
official.return_tables.none.pop(); redraw(); assert.equal(rail('accumulation-time-rail').position(),0);
assert.ok(writes > 10);
console.log('P4/P6/both P7 rails: capture before replacement, restore after render, isolation and dependent reset passed');
'''
subprocess.run(['node', '--input-type=module', '-e', script], check=True)
print('timeline scroll and P3 input regression contracts passed')
