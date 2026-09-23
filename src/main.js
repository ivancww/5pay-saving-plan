import { loadOfficialData, loadOverrides, saveOverrides } from './data.js';
import { createState, goBack, goTo } from './state.js';
import { exportCustomerView } from './pdf.js';
import { render } from './views.js';

const app = document.querySelector('#app');
const state = createState();
let official = null; let meta = { source: 'loading' }; let overrides = loadOverrides();

function draw() {
  render(app, state, official || { flow: [], page_content: [], strategies: [], current_methods: [], return_tables: {}, version: {} }, overrides, meta);
}
function nextPage() {
  const flow = official?.flow || [];
  const current = flow.findIndex(page => page.page_id === state.pageId);
  const next = flow.slice(current + 1).find(page => page.enabled !== false);
  if (next) goTo(state, next.page_id);
  draw();
}
function updateField(target) {
  if (target.dataset.field) state.session[target.dataset.field] = target.value === '' ? null : Number(target.value);
  if (target.dataset.assumption) {
    const key = { 'customer-return-rate':'returnRate', 'current-rate':'currentRate', 'maturity-rate':'maturityRate', 'existing-value':'existingValue' }[target.dataset.assumption];
    state.session.assumptions[key] = target.value === '' ? null : Number(target.value);
  }
}

app.addEventListener('input', event => { updateField(event.target); });
app.addEventListener('click', event => {
  const control = event.target.closest('[data-action]'); if (!control) return;
  const action = control.dataset.action;
  if (action === 'select-method') { state.session.currentMethod = control.dataset.value; goTo(state, 'P2'); }
  if (action === 'select-purpose') { state.session.purpose = control.dataset.value; goTo(state, 'P3'); }
  if (action === 'next') nextPage();
  if (action === 'back') goBack(state);
  if (action === 'select-year') state.session.policyYear = Number(control.dataset.value);
  if (action === 'select-strategy') state.session.strategyCode = control.dataset.value;
  if (action === 'customer-view') state.customerView = true;
  if (action === 'close-customer') state.customerView = false;
  if (action === 'print') exportCustomerView();
  if (action === 'save-override') {
    overrides[`${state.pageId}.title`] = document.querySelector('#edit-title').value;
    overrides[`${state.pageId}.subtitle`] = document.querySelector('#edit-subtitle').value;
    saveOverrides(overrides); state.mode = 'use';
  }
  if (action === 'restore-defaults') { delete overrides[`${state.pageId}.title`]; delete overrides[`${state.pageId}.subtitle`]; saveOverrides(overrides); state.mode = 'use'; }
  draw();
});

document.querySelector('#customer-view-button').addEventListener('click', () => { state.customerView = true; draw(); });
document.querySelector('#edit-toggle').addEventListener('click', () => { state.mode = state.mode === 'edit' ? 'use' : 'edit'; draw(); });
document.querySelector('#reset-session').addEventListener('click', () => location.reload());

draw();
loadOfficialData().then(result => { official = result.official; meta = result; draw(); }).catch(error => { meta = { source: 'error', error }; draw(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
