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
const labels = { flow: 'Saving_Flow · P1–P7', page_content: 'Saving_Page_Content · 對話內容', routing: 'Saving_Routing · 導向映射', current_methods: 'Saving_Current_Methods · 現有方法', withdrawal_strategies: 'Saving_Withdrawal_Strategies · 使用策略', customer_view: 'Saving_Customer_View · 客戶頁' };

export function renderAdmin(app, official, state = {}) {
  if (state.error) { app.innerHTML = `<div class="ava-status ava-status--warning" role="alert"><strong>Saving Admin 未能啟動。</strong><p>${escapeHtml(state.error)}</p><p>沒有有效 Platform launch 或 App Grant 時，Official data 不會寫入。</p></div>`; return; }
  const values = { flow: official.flow || [], page_content: official.page_content || [], routing: official.routing || [], current_methods: official.current_methods || [], withdrawal_strategies: official.strategies || official.withdrawal_strategies || [], customer_view: official.customer_view || [] };
  app.innerHTML = `<div class="front-wrap admin-surface"><div class="front-topline"><span>AVA Studio · Saving Admin</span><span>Official Layer only</span></div><section class="ava-card admin-intro"><h1 class="ava-page-title">Saving Official 設定</h1><p class="ava-support">只管理 Saving 現有 Official configuration。Return tables、計算公式、User/local overrides 和安全設定不可在此修改。</p><p class="ava-status ava-status--warning">發佈前會由 Saving GAS server-side 驗證 Platform App Grant、App ID 及所有欄位；前端狀態不是授權。</p></section>${ADMIN_DOMAINS.map(domain => `<section class="ava-card admin-domain"><label class="ava-label" for="admin-${domain}">${labels[domain]}</label><textarea class="ava-input admin-json" id="admin-${domain}" data-admin-domain="${domain}" spellcheck="false"></textarea></section>`).join('')}<div class="actions"><button class="ava-button ava-button--primary" data-action="publish-admin" type="button">發佈 Official 設定</button><span class="quiet-note" id="admin-publish-status">${state.message ? escapeHtml(state.message) : 'User/local overrides 不會被此操作覆蓋。'}</span></div></div>`;
  ADMIN_DOMAINS.forEach(domain => { const field = app.querySelector(`[data-admin-domain="${domain}"]`); field.value = JSON.stringify(values[domain], null, 2); });
}

export function readAdminPayload(app) {
  const data = {};
  ADMIN_DOMAINS.forEach(domain => {
    const field = app.querySelector(`[data-admin-domain="${domain}"]`);
    if (!field) throw new Error(`Missing Admin field: ${domain}`);
    const value = JSON.parse(field.value);
    if (!Array.isArray(value)) throw new Error(`${domain} 必須是 rows array。`);
    data[domain] = value;
  });
  return data;
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
