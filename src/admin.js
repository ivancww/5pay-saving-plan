import { ENDPOINT } from './data.js';

export const ADMIN_DOMAINS = Object.freeze([
  'flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view'
]);

export async function exchangeAdminLaunch(launchTicket, fetchImpl = globalThis.fetch) {
  if (!launchTicket) throw new Error('此 Admin 入口沒有有效啟動票據。');
  const response = await fetchImpl(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'exchangeAppLaunch', launchTicket }) });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true || !payload.appGrant) throw new Error(payload.error || 'Admin 啟動被拒絕。');
  return { appGrant: payload.appGrant, expiresAt: payload.expiresAt || null };
}

export async function publishOfficial(appGrant, data, fetchImpl = globalThis.fetch) {
  if (!appGrant) throw new Error('Admin 授權不存在。');
  const domains = Object.keys(data || {});
  if (!domains.length || domains.some(domain => !ADMIN_DOMAINS.includes(domain))) throw new Error('只可以發佈 Saving Official 設定。');
  const response = await fetchImpl(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'publish_content', appGrant, ...data }) });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) throw new Error(payload.error || 'Official 發佈失敗。');
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
