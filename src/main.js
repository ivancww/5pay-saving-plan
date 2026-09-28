import { applyLocalOverrides, loadOfficialData, loadOverrides, saveOverrides } from './data.js';
import { createState, goBack, goTo } from './state.js';
import { exportCustomerView } from './pdf.js';
import { render } from './views.js';
import { MEDIA_TYPES, MEDIA_LIMITS, normalizeMedia } from './media.js';
import { downloadPortableBackup, validatePortableBackup } from './portable.js';

const app = document.querySelector('#app');
const state = createState();
let official = null; let meta = { source: 'loading' }; let overrides = loadOverrides();
const avaReturnLink = document.querySelector('#return-ava');
if (avaReturnLink) {
  const integrated = ['frontend', 'user', 'admin'].includes(new URLSearchParams(location.search).get('avaEntry'));
  avaReturnLink.href = integrated ? '../../index.html' : '../avaplatform/index.html';
}

function draw() {
  const base = official || { flow: [], page_content: [], strategies: [], current_methods: [], return_tables: {}, version: {} };
  render(app, state, applyLocalOverrides(base, overrides), overrides, meta);
}
function nextPage() {
  const flow = applyLocalOverrides(official || {}, overrides).flow || [];
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
    saveOverrides(overrides); state.pageId = 'P1'; state.history = []; state.mode = 'use'; draw();
  } catch { window.alert('備份檔案無法讀取。'); }
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
  if (action === 'backup') downloadPortableBackup(overrides);
  if (action === 'reconnect-media') window.alert('雲端媒體服務尚未連接，請先完成 AVA Platform 授權。');
  if (action === 'save-override') {
    const page = document.querySelector('#edit-title')?.closest('[data-edit-page]');
    const pageId = page?.dataset.editPage || state.pageId;
    overrides.pages ||= {};
    overrides.pages[pageId] = { ...(overrides.pages[pageId] || {}), title: document.querySelector('#edit-title').value, subtitle: document.querySelector('#edit-subtitle').value };
    const visible = document.querySelector('#edit-visible');
    if (visible) overrides.pages[pageId].hidden = !visible.checked;
    if (pageId.startsWith('LOCAL_')) {
      const custom = (overrides.customPages || []).find(item => item.page_id === pageId);
      if (custom) {
        const { type, media } = readPageMedia(custom);
        Object.assign(custom, {
          title: document.querySelector('#edit-title').value,
          subtitle: document.querySelector('#edit-subtitle').value,
          content: document.querySelector('#edit-content')?.value || '',
          page_type: type,
          media,
          updatedAt: new Date().toISOString()
        });
      }
    }
    document.querySelectorAll('[data-edit-card]').forEach(field => {
      overrides.cards ||= {};
      overrides.cards[field.dataset.editCard] = { ...(overrides.cards[field.dataset.editCard] || {}), [field.dataset.editPart]: field.value };
    });
    saveOverrides(overrides); state.mode = 'use';
    if (overrides.pages[pageId].hidden) {
      const firstVisible = applyLocalOverrides(official || {}, overrides).flow[0];
      state.pageId = firstVisible?.page_id || 'P1'; state.history = [];
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
    saveOverrides(overrides); state.pageId = 'P1'; state.history = []; state.mode = 'use';
  }
  if (action === 'restore-defaults') { overrides = {}; saveOverrides(overrides); state.mode = 'use'; state.pageId = 'P1'; state.history = []; }
  draw();
});

app.addEventListener('change', event => {
  if (event.target.matches('#restore-backup') && event.target.files?.[0]) restoreBackup(event.target.files[0]);
});

document.querySelector('#customer-view-button').addEventListener('click', () => { state.customerView = true; draw(); });
document.querySelector('#edit-toggle').addEventListener('click', () => { state.mode = state.mode === 'edit' ? 'use' : 'edit'; draw(); });
document.querySelector('#reset-session').addEventListener('click', () => location.reload());

draw();
loadOfficialData().then(result => { official = result.official; meta = result; draw(); }).catch(error => { meta = { source: 'error', error }; draw(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
