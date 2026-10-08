import { applyLocalOverrides, loadCachedOfficial, loadOfficialData, loadOverrides, saveOverrides } from './data.js';
import { activateSavingPhase, createState, getCustomerAge, goBack, goTo, removeSavingPhase, selectPhaseWithdrawal, selectPhaseWithdrawalYear } from './state.js';
import { exportCustomerView } from './pdf.js';
import { render } from './views.js';
import { MEDIA_TYPES, MEDIA_LIMITS, normalizeMedia } from './media.js';
import { downloadPortableBackup, validatePortableBackup } from './portable.js';
import { ENTRY_MODES, avaReturnHref, getEntryMode } from './integration.js';
import { exchangeAdminLaunch, publishOfficial, readAdminPayload, renderAdmin } from './admin.js';
import { APP_VERSION, BUILD_ID } from './build.js';
import { currentPath } from './calculation.js';
import { INVESTMENT_TOOLS, SCENARIO_GOALS, investmentPath, scenarioRoute, toggleChoice } from './scenario-flow.js';

const app = document.querySelector('#app');
const versionNode = document.querySelector('#app-version');
if (versionNode) versionNode.textContent = APP_VERSION;
const formatMoney = value => value == null ? '—' : `HK$ ${Math.round(value).toLocaleString('en-US')}`;
window.__AVA_SAVING_BUILD__ = BUILD_ID;
console.info('[5PAY Saving] build %s', BUILD_ID);
const state = createState();
const entryMode = getEntryMode(location.search);
const shouldRegisterServiceWorker = [
  ENTRY_MODES.standalone,
  ENTRY_MODES.frontend,
  ENTRY_MODES.user,
  ENTRY_MODES.admin
].includes(entryMode);
let official = null; let meta = { source: 'loading' }; let overrides = loadOverrides(); let previewOverrides = null;
let adminAuthorization = null;
const avaReturnLink = document.querySelector('#return-ava');
if (avaReturnLink) {
  let parentHref = '';
  try { if (window.parent !== window) parentHref = window.parent.location.href; } catch { /* cross-context access is unavailable */ }
  const contextHref = entryMode === ENTRY_MODES.standalone ? '../avaplatform/index.html' : avaReturnHref(entryMode, { parentHref, referrer: document.referrer });
  avaReturnLink.href = contextHref || './';
  if (!contextHref) avaReturnLink.title = '未提供 AVA 返回內容；返回 Saving 首頁';
}
const editToggle = document.querySelector('#edit-toggle');
if (entryMode === ENTRY_MODES.frontend) {
  if (editToggle) editToggle.hidden = true;
  document.querySelector('#customer-view-button')?.setAttribute('hidden', '');
  document.querySelector('#reset-session')?.setAttribute('hidden', '');
}
if (entryMode === ENTRY_MODES.user) state.mode = 'edit';
if (entryMode !== ENTRY_MODES.standalone) document.querySelector('link[rel="manifest"]')?.remove();

function draw(focus = null, resetRails = []) {
  if (entryMode === ENTRY_MODES.unsupported) {
    app.innerHTML = '<div class="ava-status ava-status--warning" role="alert"><strong>此 AVA 入口未啟用。</strong><p>Saving 目前只支援 Frontstage 和 User/Edit 入口。</p></div>';
    return;
  }
  const base = official || { flow: [], page_content: [], strategies: [], current_methods: [], return_tables: {}, version: {} };
  const effectiveOverrides = previewOverrides || overrides;
  // Snapshot only the currently rendered controls; never carry positions between pages.
  const railPositions = new Map([...app.querySelectorAll('.timeline-rail[id]')].map(rail => [rail.id, {
    context: rail.dataset.scrollContext, left: rail.scrollLeft
  }]));
  render(app, state, applyLocalOverrides(base, effectiveOverrides), effectiveOverrides, meta);
  app.querySelectorAll('.timeline-rail[id]').forEach(rail => {
    const previous = railPositions.get(rail.id);
    if (resetRails.includes(rail.id)) {
      // A new phase start may be later than the other phases' starts. Keep that
      // deliberate dependent-year reset visible, without scrolling normal selections.
      const selected = rail.querySelector('[aria-selected="true"]');
      if (selected) rail.scrollLeft = selected.offsetLeft - rail.firstElementChild.offsetLeft;
    } else if (previous && previous.context === rail.dataset.scrollContext) rail.scrollLeft = previous.left;
  });
  if (focus?.id) {
    const nextTarget = document.getElementById(focus.id);
    if (nextTarget) {
      nextTarget.focus({ preventScroll: true });
      if (focus.start != null && typeof nextTarget.setSelectionRange === 'function') nextTarget.setSelectionRange(focus.start, focus.end ?? focus.start);
    }
  }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function collectEditedOverrides(base) {
  const next = clone(base);
  const page = document.querySelector('#edit-title')?.closest('[data-edit-page]');
  const pageId = page?.dataset.editPage || state.pageId;
  next.pages ||= {};
  next.pages[pageId] = { ...(next.pages[pageId] || {}), title: document.querySelector('#edit-title').value, subtitle: document.querySelector('#edit-subtitle').value };
  const visible = document.querySelector('#edit-visible');
  if (visible) next.pages[pageId].hidden = !visible.checked;
  if (pageId.startsWith('LOCAL_')) {
    const custom = (next.customPages || []).find(item => item.page_id === pageId);
    if (custom) {
      const { type, media } = readPageMedia(custom);
      Object.assign(custom, { title: document.querySelector('#edit-title').value, subtitle: document.querySelector('#edit-subtitle').value, content: document.querySelector('#edit-content')?.value || '', page_type: type, media, updatedAt: new Date().toISOString() });
    }
  }
  document.querySelectorAll('[data-edit-card]').forEach(field => {
    next.cards ||= {};
    next.cards[field.dataset.editCard] = { ...(next.cards[field.dataset.editCard] || {}), [field.dataset.editPart]: field.value };
  });
  return next;
}
function nextPage() {
  if (state.pageId === 'P3' && getCustomerAge(state) == null) {
    state.session.ageError = true;
    draw();
    document.querySelector('#customer-age')?.focus();
    return;
  }
  const flow = applyLocalOverrides(official || {}, overrides).flow || [];
  const current = flow.findIndex(page => page.page_id === state.pageId);
  const next = flow.slice(current + 1).find(page => page.enabled !== false);
  if (next) goTo(state, next.page_id);
  draw();
}
function updateField(target) {
  if (target.dataset.field) state.session[target.dataset.field] = target.value === '' ? null : Number(target.value);
  if (target.dataset.field === 'currentAge') state.session.ageError = false;
  if (target.dataset.assumption) {
    const key = { 'customer-return-rate':'returnRate', 'current-rate':'currentRate', 'maturity-rate':'maturityRate', 'existing-value':'existingValue' }[target.dataset.assumption];
    state.session.assumptions[key] = target.value === '' ? null : Number(target.value);
  }
}

function updateP3Live() {
  const path = currentPath({ method: state.session.currentMethod, amount: state.session.annualContribution, assumptions: state.session.assumptions });
  const annualValue = document.querySelector('#p3-annual-contribution-value');
  const pathValue = document.querySelector('#p3-current-path-value');
  const pathUnit = document.querySelector('#p3-current-path-unit');
  const pathStatus = document.querySelector('#p3-current-path-status');
  if (annualValue) annualValue.textContent = formatMoney(state.session.annualContribution);
  if (pathValue) pathValue.textContent = path.value == null ? '—' : formatMoney(path.value);
  if (pathUnit) pathUnit.textContent = path.kind === 'known' ? '按每年安排累積' : '按你輸入的假設';
  if (pathStatus) {
    pathStatus.className = `path-status path-status--${path.kind}`;
    pathStatus.textContent = path.label;
  }
}

function readPageMedia(page) {
  const type = document.querySelector('#edit-page-type')?.value || page?.page_type || 'content';
  const fields = [...document.querySelectorAll('[data-media-index]')];
  const media = [];
  fields.forEach(field => {
    const index = Number(field.dataset.mediaIndex);
    media[index] ||= {};
    media[index][field.dataset.mediaPart] = field.value;
  });
  return { type, media: media.slice(0, MEDIA_LIMITS[type] || 0).map((item, index) => normalizeMedia({ ...item, displayOrder: index }, type)) };
}

async function restoreBackup(file) {
  try {
    const result = validatePortableBackup(JSON.parse(await file.text()));
    if (!result.valid) { window.alert(result.message); return; }
    overrides = result.data;
    saveOverrides(overrides); state.pageId = 'START'; state.history = []; state.mode = 'use'; draw();
  } catch { window.alert('備份檔案無法讀取。'); }
}

app.addEventListener('input', event => {
  const target = event.target;
  const liveField = target.matches('[data-field], [data-assumption]');
  const p3Editing = state.pageId === 'P3' && liveField;
  updateField(target);
  if (p3Editing) { updateP3Live(); return; }
  if (!liveField) return;
});
app.addEventListener('click', event => {
  const control = event.target.closest('[data-action]'); if (!control) return;
  const action = control.dataset.action;
  if (action === 'select-scenario') {
    const choice = control.dataset.value;
    const destination = scenarioRoute(official, choice);
    if (state.pageId === 'START' && destination) {
      state.session.scenario = choice;
      state.session.currentMethod = null;
      state.session.investmentTools = [];
      state.session.scenarioGoals = [];
      state.session.marketResponse = null;
      state.session.maturityResponse = null;
      state.session.mixedFocus = null;
      goTo(state, destination);
    }
  }
  if (action === 'toggle-investment-tool' && state.pageId === 'S2_TOOLS') state.session.investmentTools = toggleChoice(state.session.investmentTools, control.dataset.value, INVESTMENT_TOOLS);
  if (action === 'continue-investment-tools' && state.pageId === 'S2_TOOLS') {
    const path = investmentPath(state.session.investmentTools);
    if (path) goTo(state, scenarioRoute(official, path === 'S2_MIXED' ? 'scenario2_market' : `scenario2_${path.slice(3).toLowerCase()}`));
  }
  if (action === 'select-market-response' && state.pageId === 'S2_MARKET' && ['hold', 'reduce', 'wait'].includes(control.dataset.value)) state.session.marketResponse = control.dataset.value;
  if (action === 'select-maturity-response' && state.pageId === 'S2_MATURITY' && ['renew', 'compare', 'switch', 'later'].includes(control.dataset.value)) state.session.maturityResponse = control.dataset.value;
  if (action === 'select-mixed-focus' && state.pageId === 'S2_MIXED' && ['market', 'maturity'].includes(control.dataset.value)) state.session.mixedFocus = control.dataset.value;
  if (action === 'toggle-goal' && state.pageId === 'S3_GOALS') state.session.scenarioGoals = toggleChoice(state.session.scenarioGoals, control.dataset.value, SCENARIO_GOALS);
  if (action === 'continue-goals' && state.pageId === 'S3_GOALS' && state.session.scenarioGoals.length) goTo(state, scenarioRoute(official, 'scenario3_goals'));
  if (action === 'continue-market-to-maturity' && state.pageId === 'S2_MARKET' && state.session.marketResponse) goTo(state, scenarioRoute(official, 'scenario2_maturity'));
  if (action === 'continue-maturity-to-mixed' && state.pageId === 'S2_MATURITY' && state.session.maturityResponse) goTo(state, scenarioRoute(official, 'scenario2_mixed'));
  if (action === 'continue-to-saving' && ((state.pageId === 'S2_MARKET' && state.session.marketResponse && !state.session.investmentTools.some(key => key === 'fixed_deposit' || key === 'bond')) || (state.pageId === 'S2_MATURITY' && state.session.maturityResponse && !state.session.investmentTools.some(key => key === 'stock' || key === 'etf')) || state.pageId === 'S2_MIXED' || state.pageId === 'S3_TRADEOFF')) goTo(state, scenarioRoute(official, 'scenario_to_saving'));
  if (action === 'select-method') { state.session.currentMethod = control.dataset.value; goTo(state, 'P2'); }
  if (action === 'select-purpose') { state.session.purpose = control.dataset.value; goTo(state, 'P3'); }
  if (action === 'next') nextPage();
  if (action === 'back') goBack(state);
  if (action === 'select-year') state.session.policyYear = Number(control.dataset.value);
  if (action === 'select-withdrawal-start') {
    selectPhaseWithdrawal(state.session, Number(control.dataset.phaseId || 1), control.dataset.strategyCode, official);
  }
  if (action === 'select-withdrawal-year') selectPhaseWithdrawalYear(state.session, Number(control.dataset.phaseId || 1), control.dataset.value, official);
  if (action === 'add-saving-phase' && state.pageId === 'P5') activateSavingPhase(state.session);
  if (action === 'remove-saving-phase' && state.pageId === 'P5') removeSavingPhase(state.session, Number(control.dataset.phaseId));
  if (action === 'select-strategy') state.session.strategyCode = control.dataset.value;
  if (action === 'customer-view') state.customerView = true;
  if (action === 'close-customer') state.customerView = false;
  if (action === 'print') exportCustomerView();
  if (action === 'backup') downloadPortableBackup(overrides);
  if (action === 'reconnect-media') window.alert('雲端媒體服務尚未連接，請先完成 AVA Platform 授權。');
  if (action === 'preview') { previewOverrides = collectEditedOverrides(overrides); state.mode = 'preview'; draw(); return; }
  if (action === 'return-edit') { state.mode = 'edit'; draw(); return; }
  if (action === 'save-preview') { overrides = previewOverrides || overrides; previewOverrides = null; saveOverrides(overrides); state.mode = 'use'; draw(); return; }
  if (action === 'publish-admin' && entryMode === ENTRY_MODES.admin) { publishAdmin(); return; }
  if (action === 'save-override') {
    const pageId = document.querySelector('#edit-title')?.closest('[data-edit-page]')?.dataset.editPage || state.pageId;
    overrides = collectEditedOverrides(overrides);
    saveOverrides(overrides); state.mode = 'use';
    if (overrides.pages[pageId].hidden) {
      const firstVisible = applyLocalOverrides(official || {}, overrides).flow[0];
      state.pageId = firstVisible?.page_id || 'START'; state.history = [];
    }
  }
  if (action === 'move-page') {
    const flow = applyLocalOverrides(official || {}, overrides).flow;
    const index = flow.findIndex(page => page.page_id === state.pageId);
    const targetIndex = index + Number(control.dataset.direction);
    if (index >= 0 && targetIndex >= 0 && targetIndex < flow.length) {
      overrides.pages ||= {};
      const current = flow[index]; const target = flow[targetIndex];
      overrides.pages[current.page_id] = { ...(overrides.pages[current.page_id] || {}), order: target.order };
      overrides.pages[target.page_id] = { ...(overrides.pages[target.page_id] || {}), order: current.order };
      saveOverrides(overrides);
    }
  }
  if (action === 'add-page') {
    overrides.customPages ||= [];
    const id = `LOCAL_${Date.now()}`;
    const now = new Date().toISOString();
    overrides.customPages.push({ page_id: id, page_type: 'content', title: '自訂對話頁', subtitle: '只在此裝置顯示的內容。', content: '', media: [], order: 3.5 + overrides.customPages.length / 100, enabled: true, localOnly: true, createdAt: now, updatedAt: now });
    saveOverrides(overrides); state.pageId = id; state.mode = 'edit';
  }
  if (action === 'add-media-page') {
    overrides.customPages ||= [];
    const id = `LOCAL_${Date.now()}`; const now = new Date().toISOString();
    const type = control.dataset.mediaType === MEDIA_TYPES.video ? MEDIA_TYPES.video : MEDIA_TYPES.image;
    overrides.customPages.push({ page_id: id, page_type: type, title: type === MEDIA_TYPES.image ? 'Image 媒體頁' : 'Video 媒體頁', subtitle: '只在此裝置保存的媒體內容。', content: '', media: [normalizeMedia({ displayOrder: 0 }, type)], order: 3.5 + overrides.customPages.length / 100, enabled: true, localOnly: true, createdAt: now, updatedAt: now });
    saveOverrides(overrides); state.pageId = id; state.mode = 'edit';
  }
  if (action === 'add-media-reference') {
    const page = (overrides.customPages || []).find(item => item.page_id === state.pageId);
    if (page) {
      const type = page.page_type === MEDIA_TYPES.video ? MEDIA_TYPES.video : MEDIA_TYPES.image;
      if ((page.media || []).length < MEDIA_LIMITS[type]) page.media = [...(page.media || []), normalizeMedia({ displayOrder: page.media?.length || 0 }, type)];
      page.updatedAt = new Date().toISOString(); saveOverrides(overrides);
    }
  }
  if (action === 'delete-page' && state.pageId.startsWith('LOCAL_')) {
    overrides.customPages = (overrides.customPages || []).filter(page => page.page_id !== state.pageId);
    saveOverrides(overrides); state.pageId = 'START'; state.history = []; state.mode = 'use';
  }
  if (action === 'restore-defaults') { overrides = {}; saveOverrides(overrides); state.mode = 'use'; state.pageId = 'START'; state.history = []; }
  // A start selection already resets the dependent policy year, even on reselect.
  draw(null, action === 'select-withdrawal-start' ? [Number(control.dataset.phaseId || 1) === 1 ? 'withdrawal-explore-rail' : `withdrawal-explore-rail-${control.dataset.phaseId}`] : []);
});

app.addEventListener('change', event => {
  if (event.target.matches('#restore-backup') && event.target.files?.[0]) restoreBackup(event.target.files[0]);
});

document.querySelector('#customer-view-button').addEventListener('click', () => { state.customerView = true; draw(); });
document.querySelector('#edit-toggle').addEventListener('click', () => { state.mode = state.mode === 'edit' ? 'use' : 'edit'; draw(); });
document.querySelector('#reset-session').addEventListener('click', () => location.reload());

async function publishAdmin() {
  try {
    const status = document.querySelector('#admin-publish-status'); if (status) status.textContent = '驗證並發佈中…';
    const expectedVersion = official?.version?.data_version || official?.version?.last_updated || official?.version?.module_version || '';
    await publishOfficial(adminAuthorization.adminSessionProof, readAdminPayload(app), expectedVersion);
    const result = await loadOfficialData(); official = result.official; meta = result;
    renderAdmin(app, official, { message: 'Official 設定已發佈；User/local overrides 保持不變。' });
  } catch (error) { renderAdmin(app, official || {}, { error: error.message }); }
}

async function startAdmin() {
  const params = new URLSearchParams(location.search);
  const launchTicket = params.get('avaAdminLaunch');
  const launchNonce = params.get('avaAdminLaunchNonce');
  if (!launchTicket || !launchNonce) { renderAdmin(app, {}, { error: '缺少完整的一次性 AVA Admin launch。' }); return; }
  try {
    adminAuthorization = await exchangeAdminLaunch({ launchTicket, launchNonce });
    const cleanUrl = new URL(location.href); cleanUrl.searchParams.delete('avaAdminLaunch'); cleanUrl.searchParams.delete('avaAdminLaunchNonce'); history.replaceState(null, '', cleanUrl.href);
    const result = await loadOfficialData(); official = result.official; meta = result;
    renderAdmin(app, official);
  } catch (error) { adminAuthorization = null; renderAdmin(app, {}, { error: error.message }); }
}
function registerSavingServiceWorker() {
  if (!shouldRegisterServiceWorker || !('serviceWorker' in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(registration => registration.update())
    .catch(() => {});
}

if (entryMode === ENTRY_MODES.admin) startAdmin();
else {
  draw();
  const cachedOfficial = loadCachedOfficial();
  if (cachedOfficial) { official = cachedOfficial; meta = { source: 'local-cache', stale: true }; draw(); }
  loadOfficialData().then(result => { official = result.official; meta = result; draw(); }).catch(error => { meta = { source: 'error', error }; draw(); });
}
registerSavingServiceWorker();
