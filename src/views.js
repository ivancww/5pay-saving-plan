import { calculateOfficial, currentPath, supportedYears } from './calculation.js';
import { ageAtPolicyYear, getCustomerAge } from './state.js';
import { MEDIA_TYPES, mediaCanRender, mediaFallbackLabel, normalizeMediaList } from './media.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const money = value => value == null ? '—' : `HK$ ${Math.round(value).toLocaleString('en-US')}`;
const pct = value => `${(Number(value) * 100).toFixed(Number(value) % 0.01 ? 1 : 0)}%`;
const pageContent = (official, pageId) => official?.page_content?.filter(item => item.page_id === pageId) || [];

export function render(app, state, official, overrides = {}, meta = {}) {
  if (state.customerView) { app.innerHTML = customerView(state, official, meta); return; }
  const page = official?.flow?.find(item => item.page_id === state.pageId) || { page_id: state.pageId, title: 'AVA Saving', subtitle: '' };
  const title = page.title;
  const subtitle = page.subtitle;
  const body = page.page_id.startsWith('LOCAL_') ? customPage(page) : ({ P1:p1, P2:p2, P3:p3, P4:p4, P5:p5, P6:p6, P7:p7 }[state.pageId]?.(state, official) || unavailable('未有這一頁的官方內容。'));
  app.innerHTML = `<div class="front-wrap" data-ava-mode="${state.mode}">
    ${state.history.length ? '<button class="back-link" data-action="back" type="button">← 返回上一頁</button>' : ''}
    <section class="ava-concept" aria-labelledby="page-title">
      <div class="eyebrow">${esc(page.page_id)} · ${state.mode === 'edit' ? '編輯模式' : '對話進行中'}</div>
      <h1 class="ava-page-title" id="page-title">${esc(title)}</h1>
      <p class="ava-support">${esc(subtitle)}</p>
      ${body}
    </section>
  </div>`;
  if (state.mode === 'edit') renderEditPanel(app, state, page, title, subtitle);
  if (state.mode === 'preview') renderPreviewPanel(app);
}

function p1(state, official) { return `<div class="conversation-grid">${pageContent(official, 'P1').map(card => choice(card, 'method')).join('')}</div><p class="quiet-note">你可以先講，我哋只係用呢個選擇幫手接住之後嘅畫面。</p>`; }
function p2(state, official) { return `<div class="conversation-grid">${pageContent(official, 'P2').map(card => choice(card, 'purpose')).join('')}</div>`; }
function choice(card, kind) { return `<button class="ava-card ava-card--interactive" data-action="select-${kind}" data-value="${esc(card.action_key)}" data-card-id="${esc(card.content_id || card.action_key)}" type="button"><span class="card-icon" aria-hidden="true">${kind === 'method' ? '○' : '✦'}</span><span><strong>${esc(card.headline)}</strong><small>${esc(card.subtext)}</small></span></button>`; }

function customPage(page) {
  const pageType = page.page_type || 'content';
  const media = normalizeMediaList(page.media, pageType);
  const mediaContent = pageType === MEDIA_TYPES.image ? imageGrid(media) : pageType === MEDIA_TYPES.video ? videoPlayer(media[0]) : '';
  return `<div class="ava-card custom-page-content">${mediaContent}<p class="custom-page-support">${esc(page.content || '這是一頁只在本機保存的對話內容，不會改動官方 Saving 數據。')}</p><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">繼續 →</button></div></div>`;
}

function imageGrid(media) {
  if (!media.length) return mediaUnavailable();
  return `<div class="ava-media-grid ava-media-grid--${media.length}" aria-label="圖片內容">${media.map(item => mediaCanRender(item) ? `<figure class="ava-media-frame"><img src="${esc(item.cloudFileRef)}" alt="${esc(item.altText || item.title || 'Saving 圖片')}" loading="lazy"><figcaption>${esc(item.title)}</figcaption></figure>` : mediaUnavailable()).join('')}</div>`;
}
function videoPlayer(media) {
  if (!media || !mediaCanRender(media)) return mediaUnavailable();
  return `<div class="ava-video-frame"><video controls preload="metadata" playsinline src="${esc(media.cloudFileRef)}"></video></div>`;
}
function mediaUnavailable() { return `<div class="ava-media-fallback" role="status"><strong>${mediaFallbackLabel()}</strong><span>請重新連結雲端媒體後再試。</span><button class="ava-button ava-button--subtle" data-action="reconnect-media" type="button">重新連結</button></div>`; }

function p3(state, official) {
  const method = official.current_methods?.find(item => item.method_key === state.session.currentMethod);
  const path = currentPath({ method: state.session.currentMethod, amount: state.session.annualContribution, assumptions: state.session.assumptions });
  return `<div class="path-card"><div class="card-kicker">${esc(method?.display_name || '而家嘅做法')}</div><h2>${esc(method?.visual_title || '同一筆錢，時間耐咗會點？')}</h2><div class="metric-row"><div class="ava-metric"><span class="ava-label">每年安排金額</span><strong class="ava-metric__value">${money(state.session.annualContribution)}</strong><span class="ava-metric__unit">你輸入的金額</span></div><div class="ava-metric"><span class="ava-label">5年後現有方法預計有幾多</span><strong class="ava-metric__value">${path.value == null ? '—' : money(path.value)}</strong><span class="ava-metric__unit">${path.kind === 'known' ? '按每年安排累積' : '按你輸入的假設'}</span></div><div class="path-status path-status--${path.kind}">${esc(path.label)}</div></div></div>
    <div class="ava-card input-card"><label class="ava-label" for="annual-contribution">如果用同一筆錢，每年大概安排幾多？</label><div class="money-input"><span>HK$</span><input id="annual-contribution" data-field="annualContribution" inputmode="numeric" type="number" min="1" step="1000" value="${state.session.annualContribution || ''}" placeholder="例如 100000"></div><label class="ava-label field-inline" for="customer-age">你而家幾多歲？<input id="customer-age" data-field="currentAge" inputmode="numeric" type="number" min="0" max="120" step="1" value="${state.session.currentAge ?? ''}" placeholder="例如 40" required></label><p class="ava-help">只用於將時間點翻譯成歲數。</p>${state.session.ageError ? '<p class="ava-status ava-status--warning" role="alert">請先輸入目前歲數，時間軸才可以顯示正確歲數。</p>' : ''}${assumptionFields(state)}</div>
    <div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">加入時間後會係點 →</button></div>`;
}
function assumptionFields(state) {
  if (state.session.currentMethod === 'investment') return field('customer-return-rate', '客戶假設年回報（可留空）', state.session.assumptions.returnRate ?? '', '%');
  if (state.session.currentMethod === 'fixed_deposit') return field('current-rate', '今期定期利率（可留空）', state.session.assumptions.currentRate ?? '', '%');
  if (state.session.currentMethod === 'bond') return field('maturity-rate', '債券年利率（可留空）', state.session.assumptions.maturityRate ?? '', '%');
  if (state.session.currentMethod === 'long_term') return field('existing-value', '現有安排金額（可留空）', state.session.assumptions.existingValue ?? '', 'HK$');
  return '';
}
function field(id, label, value, suffix) { return `<label class="ava-label field-inline" for="${id}">${label}<span><input id="${id}" data-assumption="${id}" type="number" min="0" step="0.1" value="${esc(value)}"> ${suffix}</span></label>`; }

function p4(state, official) {
  const years = supportedYears(official, 'none');
  const selectedYear = years.includes(state.session.policyYear) ? state.session.policyYear : years[0];
  const saving = calculateOfficial({ annualContribution: state.session.annualContribution, policyYear: selectedYear, strategyCode: 'none', official });
  const current = currentPath({ method: state.session.currentMethod, amount: state.session.annualContribution, assumptions: state.session.assumptions, projectionYears: selectedYear });
  const timeline = rangeTimeline({ id: 'comparison-time-slider', values: years, selected: selectedYear, dataAttribute: 'year-slider', labels: years.join(',') });
  return `<div class="comparison-intro">同一筆每年安排<br><span>＋ 同一段時間</span><br><strong>↓ 兩種方法最後有幾多</strong></div>${timeline}<div class="comparison-stack"><div class="resource-card resource-card--current"><span class="card-kicker">現有方法</span><strong>${current.value == null ? '—' : money(current.value)}</strong><span>${esc(official.current_methods?.find(x => x.method_key === state.session.currentMethod)?.display_name || '而家嘅做法')} · ${current.value == null ? '請先輸入所需假設' : `到 ${selectedYear} 年`}</span></div><div class="plus">對比</div><div class="resource-card resource-card--new"><span class="card-kicker">另一種 Saving 安排</span><strong>${saving.available ? money(saving.futureValue) : '—'}</strong><span>${saving.available ? `到 ${selectedYear} 年` : esc(saving.message)}</span></div></div><p class="calculation-note">時間軸只會使用有完整資料的時間點。</p><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">了解點樣運作 →</button></div>`;
}
function p5(state) {
  const total = Number(state.session.annualContribution) * 5;
  const currentAge = getCustomerAge(state);
  const completionAge = ageAtPolicyYear(state, 5);
  return `<div class="journey"><div><span>目前歲數</span><strong>${currentAge == null ? '—' : `${currentAge}歲`}</strong></div><div class="journey-arrow">↓</div><div><span>每年安排</span><strong>${money(state.session.annualContribution)}</strong><small>持續 5 年</small></div><div class="journey-arrow">↓</div><div><span>完成供款時歲數</span><strong>${completionAge == null ? '—' : `${completionAge}歲`}</strong><small>總投入 ${money(total)}</small></div><div class="journey-arrow">↓</div><div><span>之後俾時間繼續</span><strong>睇時間點</strong></div></div><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">探索時間 →</button></div>`;
}

function timelinePoint(state, year) {
  const age = ageAtPolicyYear(state, year);
  return `<span class="timeline-point"><strong>${age == null ? '—' : `${age}歲`}</strong></span>`;
}

function rangeTimeline({ id, values, selected, dataAttribute, labels }) {
  if (!values.length) return '<p class="ava-status ava-status--warning">未有可用時間點。</p>';
  const selectedIndex = Math.max(0, values.indexOf(selected));
  return `<div class="time-bar"><input id="${id}" class="time-slider" type="range" min="0" max="${values.length - 1}" step="1" value="${selectedIndex}" data-${dataAttribute}="${labels}" aria-label="時間點"><div class="timeline-points">${values.map((value, index) => `<span class="timeline-point-marker ${index === selectedIndex ? 'is-selected' : ''}"></span>`).join('')}</div></div>`;
}

function p6(state, official) {
  const years = supportedYears(official, 'none');
  const selectedYear = years.includes(state.session.policyYear) ? state.session.policyYear : years[0];
  const result = calculateOfficial({ annualContribution: state.session.annualContribution, policyYear: selectedYear, strategyCode: 'none', official });
  const timeline = rangeTimeline({ id: 'accumulation-time-slider', values: years, selected: selectedYear, dataAttribute: 'year-slider', labels: years.join(',') });
  return `<div class="anchor-metric"><span>總投入（5年）</span><strong>${money(result.totalContribution)}</strong></div><div class="time-bar-card"><div class="time-bar-heading"><span>向左右探索年齡</span><span>可即時拖動</span></div>${timeline}<div class="timeline-labels">${years.map(year => timelinePoint(state, year)).join('')}</div></div><div class="result-card"><span class="card-kicker">${ageAtPolicyYear(state, selectedYear) == null ? '—' : `${ageAtPolicyYear(state, selectedYear)}歲`}</span><strong>${result.available ? money(result.futureValue) : '—'}</strong><span>${result.available ? '按已選時間點計算' : esc(result.message)}</span></div><div class="actions"><button class="ava-button ava-button--secondary" data-action="next" type="button">探索使用方式 →</button></div>`;
}

function p7(state, official) {
  const points = [
    ['withdraw7_from8', 8], ['withdraw12_from15', 15], ['withdraw18_from20', 20],
    ['withdraw23_from25', 25], ['withdraw29_from30', 30]
  ].map(([strategyCode, policyYear]) => {
    const item = official.strategies?.find(strategy => strategy.strategy_code === strategyCode && Number(strategy.start_year) === policyYear);
    return item ? { ...item, policyYear } : null;
  }).filter(Boolean);
  const selected = points.find(item => item.strategy_code === state.session.withdrawalStrategyCode) || points[0];
  const startYear = selected?.policyYear;
  const postYears = selected ? supportedYears(official, selected.strategy_code).filter(year => year >= startYear) : [];
  const selectedPostYear = postYears.includes(state.session.withdrawalPolicyYear) ? state.session.withdrawalPolicyYear : postYears[0];
  const result = selected ? calculateOfficial({ annualContribution: state.session.annualContribution, policyYear: selectedPostYear, strategyCode: selected.strategy_code, official }) : { available: false, message: '未有使用策略。' };
  const startLabels = points.map(item => `${item.strategy_code}:${item.policyYear}`).join('|');
  const postLabels = postYears.join(',');
  const startTimeline = rangeTimeline({ id: 'withdrawal-start-slider', values: points.map(item => item.policyYear), selected: selected?.policyYear, dataAttribute: 'withdrawal-slider', labels: startLabels });
  const postTimeline = rangeTimeline({ id: 'withdrawal-explore-slider', values: postYears, selected: selectedPostYear, dataAttribute: 'withdrawal-point-slider', labels: postLabels });
  return `<div class="timeline-stage"><h2>幾時開始用？</h2><div class="time-bar-card">${startTimeline}<div class="timeline-labels">${points.map(item => timelinePoint(state, item.policyYear)).join('')}</div></div></div><div class="timeline-stage"><h2>開始之後，時間行落去會點？</h2><div class="time-bar-card">${postTimeline}<div class="timeline-labels">${postYears.map(year => timelinePoint(state, year)).join('')}</div></div></div><div class="result-card"><span class="card-kicker">${selected ? `由 ${ageAtPolicyYear(state, startYear) == null ? '—' : `${ageAtPolicyYear(state, startYear)}歲`} 開始 · ${ageAtPolicyYear(state, selectedPostYear) == null ? '—' : `${ageAtPolicyYear(state, selectedPostYear)}歲`} 當時` : '未選擇安排'}</span><strong>${result.available ? money(result.remainingValue) : '—'}</strong><span>${result.available ? esc(selected.display_name) : esc(result.message)}</span></div><div class="withdrawal-result">${result.available ? `<div><span>每年可使用</span><strong>${money(result.annualUsable)}</strong></div><div><span>累積已使用</span><strong>${money(result.cumulativeUsed)}</strong></div><div><span>當時戶口價值</span><strong>${money(result.remainingValue)}</strong></div>` : `<p>${esc(result.message || '未有使用資料。')}</p>`}</div><div class="actions"><button class="ava-button ava-button--primary" data-action="customer-view" type="button">一 click 睇客戶頁 →</button></div>`;
}

function customerView(state, official, meta) {
  const strategyCode = state.session.withdrawalStrategyCode || state.session.strategyCode;
  const policyYear = state.session.withdrawalPolicyYear || state.session.policyYear;
  const result = calculateOfficial({ annualContribution: state.session.annualContribution, policyYear, strategyCode, official });
  const method = official.current_methods?.find(x => x.method_key === state.session.currentMethod)?.display_name || '現有安排';
  const strategy = official.strategies?.find(item => item.strategy_code === strategyCode);
  const generatedAt = new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<div class="customer-view" data-ava-mode="presentation"><div class="presentation-label">Customer Presentation · ${meta.stale ? '離線快取資料' : 'AVA Saving'}</div><h1>現有方法 ＋ 新增安排<br><span>＝ 新嘅整體資源畫面</span></h1><p class="presentation-lead">原有 ${esc(method)} 可以繼續，同時多一筆可以預先規劃嘅未來資源。</p><div class="customer-grid"><div class="customer-block"><span>你而家嘅做法</span><strong>${esc(method)}</strong><small>保留現有選擇，不作未有資料的推算。</small></div><div class="customer-block customer-block--accent"><span>新增 Saving 安排</span><strong>${result.available ? money(result.futureValue) : '—'}</strong><small>${result.available ? `第 ${result.policyYear} 年 · 官方 ${esc(result.sheetName)}` : esc(result.message)}</small></div><div class="customer-block"><span>今次投入</span><strong>${money(result.totalContribution)}</strong><small>每年 ${money(state.session.annualContribution)} × 5 年</small></div><div class="customer-block"><span>如果開始使用</span><strong>${result.annualUsable ? money(result.annualUsable) : '按策略選擇'}</strong><small>${result.annualUsable ? '每年可使用' : '可返回對話探索官方策略'}</small></div></div><p class="disclosure">以上 Saving 數字來自官方資料表的 exact policy year；客戶輸入的現有方法及任何假設會清楚分開展示。安排：${esc(strategy?.display_name || state.session.strategyCode)}；資料版本：${esc(official.version?.data_version || '未提供')}；生成日期：${generatedAt}。</p><div class="actions presentation-actions"><button class="ava-button ava-button--primary" data-action="print" type="button">匯出客戶頁 PDF</button><button class="ava-button ava-button--secondary" data-action="close-customer" type="button">返回對話</button></div></div>`;
}

function unavailable(message) { return `<div class="ava-status ava-status--warning">${esc(message)}</div>`; }
function renderEditPanel(app, state, page, title, subtitle) {
  const current = state.pageId;
  const cards = [...app.querySelectorAll(`[data-action="select-method"], [data-action="select-purpose"]`)].map((button, index) => ({ id: button.dataset.cardId, headline: button.querySelector('strong')?.textContent || '', subtext: button.querySelector('small')?.textContent || '', index }));
  const isLocal = current.startsWith('LOCAL_');
  const localPage = isLocal ? page : {};
  const type = localPage.page_type || 'content';
  const media = normalizeMediaList(localPage.media, type);
  const mediaFields = isLocal && type !== 'content' ? `<div class="media-editor"><p class="quiet-note">雲端媒體只保存 reference / metadata；本機不會保存圖片或影片檔案。</p>${media.map((item, index) => `<label class="ava-label" for="media-ref-${index}">${type === 'image' ? `圖片 ${index + 1}` : '影片'} reference<input class="ava-input" id="media-ref-${index}" data-media-index="${index}" data-media-part="cloudFileRef" value="${esc(item.cloudFileRef)}"><input class="ava-input" data-media-index="${index}" data-media-part="providerType" placeholder="provider type（平台連接後使用）" value="${esc(item.providerType)}"><input class="ava-input" data-media-index="${index}" data-media-part="altText" placeholder="替代文字" value="${esc(item.altText)}"></label>`).join('')}${media.length < (type === 'image' ? 6 : 1) ? `<button class="ava-button ava-button--secondary" data-action="add-media-reference" type="button">新增${type === 'image' ? '圖片' : '影片'} reference</button>` : ''}</div>` : '';
  app.insertAdjacentHTML('beforeend', `<section class="edit-panel ava-card" data-edit-page="${esc(current)}" aria-label="前台編輯"><h2>前台編輯</h2><p class="quiet-note">只保存本機呈現設定；官方內容、回報表及 multiplier 不可編輯。</p>${isLocal ? `<label class="ava-label" for="edit-page-type">頁面類型<select class="ava-input" id="edit-page-type"><option value="content" ${type === 'content' ? 'selected' : ''}>內容</option><option value="image" ${type === 'image' ? 'selected' : ''}>Image 媒體頁</option><option value="video" ${type === 'video' ? 'selected' : ''}>Video 媒體頁</option></select></label>` : ''}<label class="ava-label" for="edit-title">標題</label><input class="ava-input" id="edit-title" value="${esc(title)}"><label class="ava-label" for="edit-subtitle">副標題</label><textarea class="ava-input" id="edit-subtitle">${esc(subtitle)}</textarea>${isLocal ? `<label class="ava-label" for="edit-content">Supporting text / content</label><textarea class="ava-input" id="edit-content">${esc(localPage.content || '')}</textarea>${mediaFields}` : ''}<label class="field-inline" for="edit-visible"><span>顯示此頁</span><input id="edit-visible" type="checkbox" ${page.enabled !== false ? 'checked' : ''}></label>${cards.length ? `<details><summary>編輯對話卡文字</summary>${cards.map(card => `<label class="ava-label" for="edit-card-${card.index}">卡片 ${card.index + 1}<input class="ava-input" id="edit-card-${card.index}" data-edit-card="${esc(card.id)}" data-edit-part="headline" value="${esc(card.headline)}"><textarea class="ava-input" data-edit-card="${esc(card.id)}" data-edit-part="subtext">${esc(card.subtext)}</textarea></label>`).join('')}</details>` : ''}<div class="actions"><button class="ava-button ava-button--secondary" data-action="preview" type="button">預覽前台</button><button class="ava-button ava-button--primary" data-action="save-override" type="button">儲存本機設定</button><button class="ava-button ava-button--secondary" data-action="move-page" data-direction="-1" type="button">頁面上移</button><button class="ava-button ava-button--secondary" data-action="move-page" data-direction="1" type="button">頁面下移</button><button class="ava-button ava-button--subtle" data-action="add-page" type="button">新增本機內容頁</button><span class="media-add-choice">新增 Media Page：<button class="ava-button ava-button--subtle" data-action="add-media-page" data-media-type="image" type="button">Image</button><button class="ava-button ava-button--subtle" data-action="add-media-page" data-media-type="video" type="button">Video</button></span>${isLocal ? '<button class="ava-button ava-button--subtle" data-action="delete-page" type="button">刪除本機頁</button>' : ''}<button class="ava-button ava-button--subtle" data-action="backup" type="button">備份設定</button><label class="ava-button ava-button--subtle file-button" for="restore-backup">還原設定</label><input id="restore-backup" type="file" accept="application/json" data-action="restore-file"><button class="ava-button ava-button--subtle" data-action="restore-defaults" type="button">還原官方設定</button></div></section>`);
}

function renderPreviewPanel(app) {
  app.insertAdjacentHTML('beforeend', '<section class="edit-panel ava-card preview-panel" aria-label="前台預覽"><h2>前台預覽</h2><p class="quiet-note">以下就是客戶會看到的 Saving Frontstage；目前修改尚未儲存。</p><div class="actions"><button class="ava-button ava-button--secondary" data-action="return-edit" type="button">返回編輯</button><button class="ava-button ava-button--primary" data-action="save-preview" type="button">儲存本機設定</button></div></section>');
}
