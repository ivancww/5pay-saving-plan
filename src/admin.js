import { ENDPOINT } from './data.js';

export const ADMIN_DOMAINS = Object.freeze([
  'flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view'
]);

const APP_ID = '5pay';
const PLATFORM_ORIGIN = 'https://ivancww.github.io';
const BROWSER_CONTEXT_PREFIX = 'ava-admin-session-v1:';

export function browserProofFromContext(launchTicket, launchNonce, browserWindow = globalThis.window) {
  let raw = '';
  try { raw = String(browserWindow?.name || ''); browserWindow.name = ''; } catch (_) { return null; }
  if (!raw.startsWith(BROWSER_CONTEXT_PREFIX)) return null;
  let data;
  try { data = JSON.parse(raw.slice(BROWSER_CONTEXT_PREFIX.length)); }
  catch (_) { throw new Error('AVA browser proof 無效。'); }
  const expiry = Date.parse(data?.expiresAt || '');
  if (data?.type !== 'ava-admin-session-context' || data.appId !== APP_ID || data.launchTicket !== launchTicket || data.launchNonce !== launchNonce || !data.browserProof || data.contract !== 'ava-admin-session-v1' || !Number.isFinite(expiry) || expiry <= Date.now()) throw new Error('AVA browser proof 無效或已過期。');
  return data;
}

function browserProofFromOpener(launchTicket, launchNonce) {
  if (!launchTicket || !launchNonce) throw new Error('此 Admin 入口必須由 AVA Studio 啟動。');
  const contextProof = browserProofFromContext(launchTicket, launchNonce);
  if (contextProof) return Promise.resolve(contextProof);
  if (!window.opener) throw new Error('此 Admin 入口必須由 AVA Studio 啟動。');
  return new Promise((resolve, reject) => {
    const opener = window.opener;
    let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); window.removeEventListener('message', onMessage); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => finish(new Error('AVA browser binding expired')), 15000);
    const onMessage = event => {
      if (event.source !== opener || event.origin !== PLATFORM_ORIGIN) return;
      const data = event.data || {};
      if (data.type !== 'ava-admin-session-response' || data.appId !== APP_ID || data.launchTicket !== launchTicket || data.launchNonce !== launchNonce) return;
      if (!data.browserProof || data.contract !== 'ava-admin-session-v1') return finish(new Error('AVA browser proof 無效。'));
      finish(null, { browserProof: String(data.browserProof), expiresAt: data.expiresAt, contract: data.contract });
    };
    window.addEventListener('message', onMessage);
    opener.postMessage({ type: 'ava-admin-session-request', appId: APP_ID, launchTicket, launchNonce }, PLATFORM_ORIGIN);
  });
}

export async function exchangeAdminLaunch({ launchTicket, launchNonce }, fetchImpl = globalThis.fetch) {
  if (!launchTicket || !launchNonce) throw new Error('此 Admin 入口沒有完整啟動票據。');
  const browser = await browserProofFromOpener(launchTicket, launchNonce);
  const response = await fetchImpl(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'exchangeAdminSession', launchTicket, launchNonce, browserProof: browser.browserProof, appId: APP_ID }) });
  const payload = await response.json();
  const expiry = Date.parse(payload.expiresAt || '');
  if (!response.ok || payload.success !== true || payload.appId !== APP_ID || payload.contract !== 'ava-admin-session-v1' || !payload.adminSessionProof || !Number.isFinite(expiry) || expiry <= Date.now()) throw new Error(payload.error || 'Admin 啟動被拒絕。');
  return { adminSessionProof: String(payload.adminSessionProof), expiresAt: payload.expiresAt };
}

export async function publishOfficial(adminSessionProof, data, expectedRevision, fetchImpl = globalThis.fetch) {
  if (!adminSessionProof) throw new Error('Admin session proof 不存在。');
  if (!expectedRevision) throw new Error('Official revision 不存在，拒絕發佈。');
  const domains = Object.keys(data || {});
  if (!domains.length || domains.some(domain => !ADMIN_DOMAINS.includes(domain))) throw new Error('只可以發佈 Saving Official 設定。');
  const operation = '5pay:official-write:configuration';
  const response = await fetchImpl(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'publish_content', adminSessionProof, appId: APP_ID, operation, expectedVersion: expectedRevision, data }) });
  const payload = await response.json();
  const revision = String(payload?.revision || '');
  const published = Array.isArray(payload?.published) ? [...payload.published].sort() : [];
  const expectedDomains = [...domains].sort();
  if (!response.ok || payload.success !== true || payload.ok !== true || payload.appId !== APP_ID || payload.operation !== operation || JSON.stringify(published) !== JSON.stringify(expectedDomains) || payload.persisted !== true || payload.read_after_write !== true || !/^[0-9a-f]{64}$/i.test(revision) || !payload.data || typeof payload.data !== 'object') throw new Error(payload.error || 'Official 發佈確認證據不完整。');
  for (const domain of domains) {
    if (!Array.isArray(payload.data[domain]) || JSON.stringify(payload.data[domain]) !== JSON.stringify(data[domain])) throw new Error(`Official 發佈確認不一致：${domain}。`);
  }
  return payload;
}
export const ADMIN_DOMAIN_META = Object.freeze({
  flow: { label: '流程頁面', description: '設定 Saving P1–P7 的頁面順序、標題及可用狀態', sheet: 'Saving_Flow' },
  page_content: { label: '頁面內容', description: '管理對話內容、按鈕動作及顯示狀態', sheet: 'Saving_Page_Content' },
  routing: { label: '導向設定', description: '管理方法、原因與下一頁的導向關係', sheet: 'Saving_Routing' },
  current_methods: { label: '現有方法', description: '管理前台使用的儲蓄方法及其說明', sheet: 'Saving_Current_Methods' },
  withdrawal_strategies: { label: '提取策略', description: '管理提取年期、比例及受保護的官方回報表對應', sheet: 'Saving_Withdrawal_Strategies' },
  customer_view: { label: '客戶展示', description: '管理客戶頁面的內容區塊及顯示順序', sheet: 'Saving_Customer_View' }
});

export const ADMIN_FIELD_DEFINITIONS = Object.freeze({
  flow: [
    ['page_id', '頁面編號', 'text', true], ['order', '顯示順序', 'number'], ['page_type', '頁面類型', 'select'],
    ['title', '頁面標題', 'text'], ['subtitle', '頁面副標題', 'textarea'], ['enabled', '啟用頁面', 'checkbox'], ['skippable', '允許略過', 'checkbox']
  ],
  page_content: [
    ['content_id', '內容編號', 'text', true], ['page_id', '所屬頁面', 'text'], ['content_type', '內容類型', 'select'],
    ['order', '顯示順序', 'number'], ['headline', '內容標題', 'text'], ['subtext', '內容說明', 'textarea'],
    ['action_key', '動作鍵', 'text'], ['enabled', '啟用內容', 'checkbox']
  ],
  routing: [
    ['route_id', '導向編號', 'text', true], ['method_key', '方法鍵', 'text'], ['reason_key', '原因鍵', 'text'],
    ['visualization_type', '展示方式', 'select'], ['next_page', '下一頁', 'text'], ['enabled', '啟用導向', 'checkbox']
  ],
  current_methods: [
    ['method_key', '方法鍵', 'text', true], ['display_name', '顯示名稱', 'text'], ['model_type', '模型類型', 'text'],
    ['assumption_source', '假設來源', 'textarea'], ['future_rule', '未來規則', 'textarea'], ['visual_title', '展示標題', 'text'],
    ['enabled', '啟用方法', 'checkbox']
  ],
  withdrawal_strategies: [
    ['strategy_code', '策略代碼', 'text', true], ['display_name', '顯示名稱', 'text'], ['start_year', '開始年份', 'number'],
    ['withdraw_rate', '提取比例', 'number'], ['sheet_name', '官方回報表', 'select'], ['enabled', '啟用策略', 'checkbox'], ['sort_order', '顯示排序', 'number']
  ],
  customer_view: [
    ['block_id', '區塊編號', 'text', true], ['order', '顯示順序', 'number'], ['block_type', '區塊類型', 'select'],
    ['title', '區塊標題', 'text'], ['subtitle', '區塊副題', 'textarea'], ['enabled', '啟用區塊', 'checkbox']
  ]
});

const ENUM_OPTIONS = Object.freeze({
  flow: { page_type: ['conversation', 'content', 'image', 'video'] },
  page_content: { content_type: ['text', 'choice', 'note', 'media'] },
  routing: { visualization_type: ['card', 'timeline', 'bar', 'line'] },
  customer_view: { block_type: ['heading', 'text', 'metric', 'summary'] },
  withdrawal_strategies: { sheet_name: ['自動滾存', '8年領取', '15年領取', '20年領取', '25年領取', '30年領取'] }
});

const ENUM_LABELS = Object.freeze({
  conversation: '對話', content: '內容', image: '圖片', video: '影片', text: '文字', choice: '選項', note: '備註', media: '媒體',
  card: '卡片', timeline: '時間線', bar: '圖表', line: '折線圖', heading: '標題', metric: '數值', summary: '摘要'
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function valuesForDomain(official = {}) {
  const source = official.admin || official;
  return {
    flow: Array.isArray(source.flow) ? source.flow : [],
    page_content: Array.isArray(source.page_content) ? source.page_content : [],
    routing: Array.isArray(source.routing) ? source.routing : [],
    current_methods: Array.isArray(source.current_methods) ? source.current_methods : [],
    withdrawal_strategies: Array.isArray(source.withdrawal_strategies) ? source.withdrawal_strategies : (Array.isArray(source.strategies) ? source.strategies : []),
    customer_view: Array.isArray(source.customer_view) ? source.customer_view : []
  };
}

function identityKey(domain, row) { return row.page_id || row.content_id || row.route_id || row.method_key || row.strategy_code || row.block_id || `${domain}-record`; }
function optionsFor(domain, key, rows, value) {
  const configured = ENUM_OPTIONS[domain]?.[key] || [];
  const observed = rows.map(row => row[key]).filter(item => item !== undefined && item !== null && item !== '');
  return [...new Set([...configured, ...observed, value].filter(item => item !== undefined && item !== null && item !== ''))];
}
function displayOption(value) { return ENUM_LABELS[value] || value; }
function fieldValue(row, key) { return row[key] === undefined || row[key] === null ? '' : row[key]; }
function renderField(domain, row, index, definition, rows) {
  const [key, label, type, stable] = definition;
  const id = `admin-${domain}-${index}-${key}`;
  const value = fieldValue(row, key);
  const common = `id="${id}" data-admin-field="${key}" data-admin-type="${type}"`;
  const stableNote = stable ? ' <small class="admin-field-note">（穩定識別碼）</small>' : '';
  if (type === 'checkbox') return `<label class="admin-field admin-field--checkbox" for="${id}"><span>${label}${stableNote}</span><input ${common} type="checkbox" ${value === true ? 'checked' : ''}></label>`;
  if (type === 'select') return `<label class="admin-field" for="${id}"><span>${label}${stableNote}</span><select class="ava-input" ${common}>${optionsFor(domain, key, rows, value).map(option => `<option value="${escapeHtml(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escapeHtml(displayOption(String(option)))}</option>`).join('')}</select></label>`;
  if (type === 'textarea') return `<label class="admin-field" for="${id}"><span>${label}${stableNote}</span><textarea class="ava-input" ${common} ${stable ? 'readonly' : ''}>${escapeHtml(value)}</textarea></label>`;
  return `<label class="admin-field" for="${id}"><span>${label}${stableNote}</span><input class="ava-input" ${common} type="${type === 'number' ? 'number' : 'text'}" value="${escapeHtml(value)}" ${key === 'withdraw_rate' ? 'step="0.0001" min="0" max="1"' : ''} ${stable ? 'readonly' : ''}></label>`;
}

function renderRecord(domain, row, index, rows, activeIndex = 0) {
  const definitions = ADMIN_FIELD_DEFINITIONS[domain];
  const known = new Set(definitions.map(([key]) => key));
  const unknown = Object.keys(row).filter(key => !known.has(key));
  const extra = unknown.length ? `<details class="admin-extra"><summary>其他欄位已保留（${unknown.length} 項）</summary><p class="quiet-note">${escapeHtml(unknown.join('、'))} 不在此編輯器修改；儲存時會原樣保留。</p></details>` : '';
  return `<article class="admin-record" data-admin-row data-admin-domain="${domain}" data-admin-record-index="${index}" ${index === activeIndex ? '' : 'hidden'} data-row-json="${escapeHtml(JSON.stringify(row))}"><div class="admin-record-heading"><div><span class="eyebrow">${escapeHtml(identityKey(domain, row))}</span><h3>${escapeHtml(ADMIN_DOMAIN_META[domain].label)} ${index + 1}</h3></div><span class="admin-record-index">第 ${index + 1} 筆</span></div><div class="admin-field-grid">${definitions.map(definition => renderField(domain, row, index, definition, rows)).join('')}</div>${extra}</article>`;
}

function renderRecordSelector(domain, rows) {
  if (rows.length < 2) return '';
  return `<div class="admin-record-tools"><label for="admin-record-select-${domain}"><span>選擇記錄</span><select class="ava-input" id="admin-record-select-${domain}" data-admin-record-select="${domain}">${rows.map((row, index) => `<option value="${index}">${escapeHtml(identityKey(domain, row))} · 第 ${index + 1} 筆</option>`).join('')}</select></label><span class="quiet-note">先選擇要編輯的官方記錄；其他記錄會暫時收起。</span></div>`;
}

function renderPanel(domain, rows, active) {
  const meta = ADMIN_DOMAIN_META[domain];
  return `<section class="ava-card admin-domain" data-admin-panel="${domain}" role="tabpanel" tabindex="-1" ${active ? '' : 'hidden'}><div class="admin-domain-heading"><div><span class="eyebrow">${escapeHtml(meta.sheet)}</span><h2>${escapeHtml(meta.label)}</h2><p class="quiet-note">${escapeHtml(meta.description)}</p></div><span class="admin-count">${rows.length} 筆</span></div>${rows.length ? `${renderRecordSelector(domain, rows)}${rows.map((row, index) => renderRecord(domain, row, index, rows)).join('')}` : '<p class="quiet-note">目前沒有可管理的官方資料。</p>'}</section>`;
}

export function renderAdmin(app, official, state = {}) {
  if (state.error) { app.innerHTML = `<div class="ava-status ava-status--warning" role="alert"><strong>Saving Admin 未能啟動。</strong><p>${escapeHtml(state.error)}</p><p>沒有有效 Platform launch 或 App Grant 時，Official data 不會寫入。</p></div>`; return; }
  const values = valuesForDomain(official);
  const active = ADMIN_DOMAINS.includes(state.activeDomain) ? state.activeDomain : 'flow';
  app.__adminOriginal = clone(values);
  app.__adminSelectedRecord = Object.fromEntries(ADMIN_DOMAINS.map(domain => [domain, 0]));
  app.dataset.adminActive = active;
  app.dataset.adminDirty = 'false';
  app.innerHTML = `<div class="front-wrap admin-surface"><div class="front-topline"><span>AVA Studio · Saving Admin</span><span>Official Layer only</span></div><nav class="admin-tabs" aria-label="Saving 官方資料分區" role="tablist">${ADMIN_DOMAINS.map(domain => `<button id="admin-tab-${domain}" class="admin-tab ${domain === active ? 'is-active' : ''}" data-action="admin-tab" data-domain="${domain}" role="tab" aria-selected="${domain === active}" aria-controls="admin-panel-${domain}" tabindex="${domain === active ? '0' : '-1'}" type="button"><span>${escapeHtml(ADMIN_DOMAIN_META[domain].label)}</span><small>${values[domain].length} 筆</small></button>`).join('')}</nav><div class="admin-panels">${ADMIN_DOMAINS.map(domain => renderPanel(domain, values[domain], domain === active).replace(`data-admin-panel="${domain}"`, `id="admin-panel-${domain}" aria-labelledby="admin-tab-${domain}" data-admin-panel="${domain}"`)).join('')}</div><div class="actions admin-actions"><button class="ava-button ava-button--primary" data-action="publish-admin" type="button">驗證並儲存官方資料</button><button class="ava-button ava-button--secondary" data-action="admin-reset" type="button">放棄本頁修改</button><span class="quiet-note" id="admin-publish-status" role="status">${state.message ? escapeHtml(state.message) : '可切換分區；未確認的修改不會自動儲存。'}</span></div><details class="admin-system-info"><summary>系統資訊</summary><div class="admin-system-grid"><p><strong>官方資料版本</strong><span>${escapeHtml(official?.version?.data_version || official?.data_version || '未提供')}</span></p><p><strong>Canonical Revision</strong><span>${escapeHtml(official?.revision || official?.version?.revision || '未提供')}</span></p><p><strong>同步狀態</strong><span>已完成只讀 Official Data 載入；Official Write 仍須通過完整授權及保存確認。</span></p><p><strong>安全說明</strong><span>Saving GAS 會再次驗證 AVA Admin session、App ID、欄位、revision 及 read-after-write；前端狀態不是授權。</span></p></div></details></div>`;
}

function readField(field) {
  if (field.dataset.adminType === 'checkbox') return field.checked;
  if (field.dataset.adminType === 'number') return field.value === '' ? '' : Number(field.value);
  return field.value;
}

export function readAdminPayload(app) {
  const data = {};
  ADMIN_DOMAINS.forEach(domain => {
    const records = [...app.querySelectorAll(`[data-admin-row][data-admin-domain="${domain}"]`)];
    if (!records.length) throw new Error(`${domain} 必須有 rows array。`);
    data[domain] = records.map(record => {
      let row;
      try { row = JSON.parse(record.dataset.rowJson || '{}'); } catch (_) { throw new Error(`${domain} 的資料格式無法讀取。`); }
      record.querySelectorAll('[data-admin-field]').forEach(field => { row[field.dataset.adminField] = readField(field); });
      return row;
    });
  });
  return data;
}

function adminIsDirty(app) {
  if (app.dataset.adminDirty === 'true') return true;
  try { return JSON.stringify(readAdminPayload(app)) !== JSON.stringify(app.__adminOriginal || {}); } catch (_) { return false; }
}

export function switchAdminTab(app, domain) {
  if (!ADMIN_DOMAINS.includes(domain) || app.dataset.adminActive === domain) return true;
  if (adminIsDirty(app) && !globalThis.window?.confirm?.('目前分區有未儲存修改。確定放棄這些修改並切換？')) return false;
  if (adminIsDirty(app)) resetAdminTab(app);
  app.querySelectorAll('[data-admin-panel]').forEach(panel => { panel.hidden = panel.dataset.adminPanel !== domain; });
  app.querySelectorAll('[data-action="admin-tab"]').forEach(tab => { const active = tab.dataset.domain === domain; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
  app.dataset.adminActive = domain;
  app.dataset.adminDirty = 'false';
  syncAdminRecordVisibility(app, domain);
  const panel = app.querySelector(`[data-admin-panel="${domain}"]`);
  const activeTab = app.querySelector(`[data-action="admin-tab"][data-domain="${domain}"]`);
  panel?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  activeTab?.focus?.({ preventScroll: true });
  return true;
}

export function switchAdminRecord(app, domain, index) {
  if (app.dataset.adminActive !== domain) return false;
  const panel = app.querySelector(`[data-admin-panel="${domain}"]`);
  const records = [...(panel?.querySelectorAll('[data-admin-row]') || [])];
  const nextIndex = Number(index);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= records.length) return false;
  if (Number(app.__adminSelectedRecord?.[domain] || 0) === nextIndex) return true;
  if (adminIsDirty(app) && !globalThis.window?.confirm?.('目前記錄有未儲存修改。確定放棄這些修改並切換？')) return false;
  if (adminIsDirty(app)) resetAdminTab(app);
  app.__adminSelectedRecord[domain] = nextIndex;
  syncAdminRecordVisibility(app, domain);
  app.dataset.adminDirty = 'false';
  const record = records[nextIndex];
  record?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  return true;
}

function syncAdminRecordVisibility(app, domain) {
  const panel = app.querySelector(`[data-admin-panel="${domain}"]`);
  if (!panel) return;
  const records = [...panel.querySelectorAll('[data-admin-row]')];
  const selected = Number(app.__adminSelectedRecord?.[domain] || 0);
  records.forEach((record, index) => { record.hidden = index !== selected; });
  const selector = panel.querySelector('[data-admin-record-select]');
  if (selector) selector.value = String(selected);
}

export function handleAdminTabKeydown(app, event) {
  const current = event.target.closest?.('[data-action="admin-tab"]');
  if (!current) return false;
  const tabs = [...app.querySelectorAll('[data-action="admin-tab"]')];
  const index = tabs.indexOf(current);
  let nextIndex = index;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  else return false;
  event.preventDefault();
  return switchAdminTab(app, tabs[nextIndex].dataset.domain);
}

export function resetAdminTab(app) {
  const domain = app.dataset.adminActive;
  const originals = app.__adminOriginal?.[domain];
  if (!Array.isArray(originals)) return;
  const panel = app.querySelector(`[data-admin-panel="${domain}"]`);
  panel?.querySelectorAll('[data-admin-row]').forEach((record, index) => {
    const row = originals[index]; if (!row) return;
    record.dataset.rowJson = JSON.stringify(row);
    record.querySelectorAll('[data-admin-field]').forEach(field => {
      const value = fieldValue(row, field.dataset.adminField);
      if (field.dataset.adminType === 'checkbox') field.checked = value === true;
      else field.value = value;
    });
  });
  app.dataset.adminDirty = 'false';
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
