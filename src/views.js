import { calculateOfficial, currentPath, supportedYears } from './calculation.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const money = value => value == null ? '—' : `HK$ ${Math.round(value).toLocaleString('en-US')}`;
const pct = value => `${(Number(value) * 100).toFixed(Number(value) % 0.01 ? 1 : 0)}%`;
const pageContent = (official, pageId) => official?.page_content?.filter(item => item.page_id === pageId) || [];

export function render(app, state, official, overrides = {}, meta = {}) {
  if (state.customerView) return customerView(state, official, meta);
  const page = official?.flow?.find(item => item.page_id === state.pageId) || { page_id: state.pageId, title: 'AVA Saving', subtitle: '' };
  const title = overrides[`${page.page_id}.title`] || page.title;
  const subtitle = overrides[`${page.page_id}.subtitle`] || page.subtitle;
  const body = { P1:p1, P2:p2, P3:p3, P4:p4, P5:p5, P6:p6, P7:p7 }[state.pageId]?.(state, official) || unavailable('未有這一頁的官方內容。');
  app.innerHTML = `<div class="front-wrap">
    <div class="front-topline"><span>AVA Saving</span><span>${meta.stale ? '離線快取' : meta.source === 'cloud' ? '官方資料已更新' : '等待官方資料'}</span></div>
    ${state.history.length ? '<button class="back-link" data-action="back" type="button">← 返回上一頁</button>' : ''}
    <section class="ava-concept" aria-labelledby="page-title">
      <div class="eyebrow">${esc(page.page_id)} · ${state.mode === 'edit' ? '編輯模式' : '對話進行中'}</div>
      <h1 class="ava-page-title" id="page-title">${esc(title)}</h1>
      <p class="ava-support">${esc(subtitle)}</p>
      ${body}
    </section>
    <div class="flow-footer"><span>Easy for Agent → Natural Conversation → Instant Visualization → Easy for Customer</span><span>${official?.version?.data_version ? `資料 ${esc(official.version.data_version)}` : '官方資料版本未提供'}</span></div>
  </div>`;
  if (state.mode === 'edit') renderEditPanel(app, state, title, subtitle);
}

function p1(state, official) { return `<div class="conversation-grid">${pageContent(official, 'P1').map(card => choice(card, 'method')).join('')}</div><p class="quiet-note">你可以先講，我哋只係用呢個選擇幫手接住之後嘅畫面。</p>`; }
function p2(state, official) { return `<div class="conversation-grid">${pageContent(official, 'P2').map(card => choice(card, 'purpose')).join('')}</div>`; }
function choice(card, kind) { return `<button class="ava-card ava-card--interactive" data-action="select-${kind}" data-value="${esc(card.action_key)}" type="button"><span class="card-icon" aria-hidden="true">${kind === 'method' ? '○' : '✦'}</span><span><strong>${esc(card.headline)}</strong><small>${esc(card.subtext)}</small></span></button>`; }

function p3(state, official) {
  const method = official.current_methods?.find(item => item.method_key === state.session.currentMethod);
  const path = currentPath({ method: state.session.currentMethod, amount: state.session.annualContribution, assumptions: state.session.assumptions });
  return `<div class="path-card"><div class="card-kicker">${esc(method?.display_name || '而家嘅做法')}</div><h2>${esc(method?.visual_title || '同一筆錢，時間耐咗會點？')}</h2><div class="metric-row"><div class="ava-metric"><span class="ava-label">每年安排金額</span><strong class="ava-metric__value">${money(state.session.annualContribution)}</strong><span class="ava-metric__unit">客戶輸入</span></div><div class="path-status path-status--${path.kind}">${esc(path.label)}</div></div></div>
    <div class="ava-card input-card"><label class="ava-label" for="annual-contribution">如果用同一筆錢，每年大概安排幾多？</label><div class="money-input"><span>HK$</span><input id="annual-contribution" data-field="annualContribution" inputmode="numeric" type="number" min="1" step="1000" value="${state.session.annualContribution || ''}" placeholder="例如 100000"></div><p class="ava-help">呢個係今次對話的客戶輸入，不是官方回報數據。</p>${assumptionFields(state)}</div>
    <div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">睇下時間會去到邊 →</button></div>`;
}
function assumptionFields(state) {
  if (state.session.currentMethod === 'investment') return field('customer-return-rate', '客戶假設年回報（可留空）', state.session.assumptions.returnRate || '', '%');
  if (state.session.currentMethod === 'fixed_deposit') return field('current-rate', '今期定期利率（可留空）', state.session.assumptions.currentRate || '', '%');
  if (state.session.currentMethod === 'bond') return field('maturity-rate', '已知到期資料（可留空）', state.session.assumptions.maturityRate || '', '');
  if (state.session.currentMethod === 'long_term') return field('existing-value', '現有安排金額（可留空）', state.session.assumptions.existingValue || '', 'HK$');
  return '';
}
function field(id, label, value, suffix) { return `<label class="ava-label field-inline" for="${id}">${label}<span><input id="${id}" data-assumption="${id}" type="number" min="0" step="0.1" value="${esc(value)}"> ${suffix}</span></label>`; }

function p4(state, official) {
  const result = calculateOfficial({ annualContribution: state.session.annualContribution, policyYear: state.session.policyYear, strategyCode: state.session.strategyCode, official });
  return `<div class="comparison-stack"><div class="resource-card resource-card--current"><span class="card-kicker">現有方法</span><strong>${esc(official.current_methods?.find(x => x.method_key === state.session.currentMethod)?.display_name || '而家嘅做法')}</strong><span>${state.session.currentMethod === 'investment' ? '原有投資繼續，未有客戶假設就不推算市場價值。' : '先保留現有安排的真實狀態。'}</span></div><div class="plus">＋</div><div class="resource-card resource-card--new"><span class="card-kicker">另一種安排</span><strong>${result.available ? money(result.futureValue) : '—'}</strong><span>${result.available ? `第 ${result.policyYear} 年 · 官方資料 ${esc(result.sheetName)}` : esc(result.message)}</span></div></div><p class="calculation-note">Saving 官方數字只按官方表格的 exact policy year 顯示；不補值、不估算。</p><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">了解點樣運作 →</button></div>`;
}
function p5(state) { const total = Number(state.session.annualContribution) * 5; return `<div class="journey"><div><span>每年安排</span><strong>${money(state.session.annualContribution)}</strong></div><div class="journey-arrow">↓</div><div><span>持續 5 年</span><strong>1　2　3　4　5</strong></div><div class="journey-arrow">↓</div><div><span>總投入</span><strong>${money(total)}</strong></div><div class="journey-arrow">↓</div><div><span>之後俾時間繼續</span><strong>睇官方年份</strong></div></div><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">探索時間 →</button></div>`; }

function p6(state, official) {
  const years = supportedYears(official, state.session.strategyCode); const result = calculateOfficial({ annualContribution: state.session.annualContribution, policyYear: state.session.policyYear, strategyCode: state.session.strategyCode, official });
  return `<div class="anchor-metric"><span>總投入（5年）</span><strong>${money(result.totalContribution)}</strong></div><div class="time-controls" role="list" aria-label="官方支援年份">${years.map(year => `<button class="year-chip ${year === state.session.policyYear ? 'is-selected' : ''}" data-action="select-year" data-value="${year}" type="button" aria-pressed="${year === state.session.policyYear}">${year}<small>年</small></button>`).join('')}</div><div class="result-card"><span class="card-kicker">第 ${state.session.policyYear} 年 · ${esc(result.sheetName || '未選擇安排')}</span><strong>${result.available ? money(result.futureValue) : '—'}</strong><span>${result.available ? '按官方 multiplier × 總投入' : esc(result.message)}</span></div><p class="calculation-note">支援年份以官方資料為準；點選只會跳到現有資料點。</p><div class="actions"><button class="ava-button ava-button--secondary" data-action="next" type="button">探索使用方式 →</button></div>`;
}

function p7(state, official) {
  const result = calculateOfficial({ annualContribution: state.session.annualContribution, policyYear: state.session.policyYear, strategyCode: state.session.strategyCode, official });
  return `<div class="strategy-grid">${official.strategies?.map(item => `<button class="strategy-card ${state.session.strategyCode === item.strategy_code ? 'is-selected' : ''}" data-action="select-strategy" data-value="${esc(item.strategy_code)}" type="button"><strong>${esc(item.display_name)}</strong><small>${item.withdraw_rate ? `每年 ${pct(item.withdraw_rate)}` : '資源繼續滾存'}</small></button>`).join('') || '<p class="ava-status ava-status--warning">未有官方使用策略。</p>'}</div><div class="withdrawal-result">${result.available && result.annualUsable ? `<div><span>每年可使用</span><strong>${money(result.annualUsable)}</strong></div><div><span>累積已使用</span><strong>${money(result.cumulativeUsed)}</strong></div><div><span>同時仍有</span><strong>${money(result.remainingValue)}</strong></div>` : `<p>${result.available ? '選擇一個開始使用的官方策略。' : esc(result.message)}</p>`}</div><div class="actions"><button class="ava-button ava-button--primary" data-action="customer-view" type="button">一 click 睇客戶頁 →</button></div>`;
}

function customerView(state, official, meta) {
  const result = calculateOfficial({ annualContribution: state.session.annualContribution, policyYear: state.session.policyYear, strategyCode: state.session.strategyCode, official });
  const method = official.current_methods?.find(x => x.method_key === state.session.currentMethod)?.display_name || '現有安排';
  return `<div class="customer-view" data-ava-mode="presentation"><div class="presentation-label">Customer Presentation · ${meta.stale ? '離線快取資料' : 'AVA Saving'}</div><h1>現有方法 ＋ 新增安排<br><span>＝ 新嘅整體資源畫面</span></h1><p class="presentation-lead">原有 ${esc(method)} 可以繼續，同時多一筆可以預先規劃嘅未來資源。</p><div class="customer-grid"><div class="customer-block"><span>你而家嘅做法</span><strong>${esc(method)}</strong><small>保留現有選擇，不作未有資料的推算。</small></div><div class="customer-block customer-block--accent"><span>新增 Saving 安排</span><strong>${result.available ? money(result.futureValue) : '—'}</strong><small>${result.available ? `第 ${result.policyYear} 年 · 官方 ${esc(result.sheetName)}` : esc(result.message)}</small></div><div class="customer-block"><span>今次投入</span><strong>${money(result.totalContribution)}</strong><small>每年 ${money(state.session.annualContribution)} × 5 年</small></div><div class="customer-block"><span>如果開始使用</span><strong>${result.annualUsable ? money(result.annualUsable) : '按策略選擇'}</strong><small>${result.annualUsable ? '每年可使用' : '可返回對話探索官方策略'}</small></div></div><p class="disclosure">以上 Saving 數字來自官方資料表的 exact policy year；客戶輸入的現有方法及任何假設會清楚分開展示。資料版本：${esc(official.version?.data_version || '未提供')}</p><div class="actions presentation-actions"><button class="ava-button ava-button--primary" data-action="print" type="button">匯出客戶頁 PDF</button><button class="ava-button ava-button--secondary" data-action="close-customer" type="button">返回對話</button></div></div>`;
}

function unavailable(message) { return `<div class="ava-status ava-status--warning">${esc(message)}</div>`; }
function renderEditPanel(app, state, title, subtitle) { app.insertAdjacentHTML('beforeend', `<section class="edit-panel ava-card" aria-label="前台編輯"><h2>前台編輯</h2><label class="ava-label" for="edit-title">標題</label><input class="ava-input" id="edit-title" value="${esc(title)}"><label class="ava-label" for="edit-subtitle">副標題</label><textarea class="ava-input" id="edit-subtitle">${esc(subtitle)}</textarea><div class="actions"><button class="ava-button ava-button--primary" data-action="save-override" type="button">儲存本機設定</button><button class="ava-button ava-button--subtle" data-action="restore-defaults" type="button">還原官方設定</button></div></section>`); }
