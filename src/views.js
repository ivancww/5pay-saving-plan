import { activeSavingPhases, calculateSavingPortfolio, currentPath, supportedYears, phaseStrategyChoices, withdrawalPortfolio } from './calculation.js';
import { ageAtPolicyYear, getCustomerAge } from './state.js';
import { MEDIA_TYPES, mediaCanRender, mediaFallbackLabel, normalizeMediaList } from './media.js';
import { INVESTMENT_TOOLS, SCENARIO_GOALS } from './scenario-flow.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const money = value => value == null ? '—' : `HK$ ${Math.round(value).toLocaleString('en-US')}`;
const pct = value => `${(Number(value) * 100).toFixed(Number(value) % 0.01 ? 1 : 0)}%`;
const pageContent = (official, pageId) => official?.page_content?.filter(item => item.page_id === pageId) || [];

export function render(app, state, official, overrides = {}, meta = {}) {
  if (state.customerView) { app.innerHTML = customerView(state, official, meta); return; }
  const page = official?.flow?.find(item => item.page_id === state.pageId) || { page_id: state.pageId, title: 'AVA Saving', subtitle: '' };
  const bondOnly = state.pageId === 'S2_MATURITY' && state.session.investmentTools?.includes('bond') && !state.session.investmentTools.includes('fixed_deposit');
  const heading = scenarioHeading(state);
  const localPage = overrides.pages?.[state.pageId] || {};
  const title = Object.prototype.hasOwnProperty.call(localPage, 'title') ? localPage.title : bondOnly ? '如果債券有到期日，下一步會點？' : heading?.title || page.title;
  const subtitle = Object.prototype.hasOwnProperty.call(localPage, 'subtitle') ? localPage.subtitle : heading?.subtitle || page.subtitle;
  const synthetic = scenarioPage(state.pageId);
  const body = page.page_id.startsWith('LOCAL_') ? customPage(page) : (synthetic?.body(state, official) || ({ P1:p1, P2:p2, P3:p3, P4:p4, P5:p5, P6:p6, P7:p7 }[state.pageId]?.(state, official) || unavailable('未有這一頁的官方內容。')));
  app.innerHTML = `<div class="front-wrap" data-ava-mode="${state.mode}">
    ${state.history.length ? '<div class="page-control-row"><button class="ava-button ava-button--secondary back-link" data-action="back" type="button" aria-label="返回上一頁">← 返回</button></div>' : ''}
    <section class="ava-concept ava-main-card" aria-labelledby="page-title">
      <div class="flow-context">
        <div class="eyebrow">${esc(page.page_id)} · ${state.mode === 'edit' ? '編輯模式' : '對話進行中'}</div>
        <h1 class="ava-page-title" id="page-title">${esc(title)}</h1>
        <p class="ava-support">${esc(subtitle)}</p>
      </div>
      <div class="flow-body">${body}</div>
    </section>
  </div>`;
  if (state.mode === 'edit') renderEditPanel(app, state, page, title, subtitle);
  if (state.mode === 'preview') renderPreviewPanel(app);
}

function scenarioHeading(state) {
  if (state.session.scenario !== 'scenario2' && state.session.scenario !== 'scenario3') return null;
  return ({
    P2: { title: '你希望呢筆錢將來用喺邊？', subtitle: '先了解想為未來準備的方向。' },
    P3: { title: '如果另外建立一筆 Saving？', subtitle: '先輸入每年安排金額，之後再睇官方已知數字。' },
    P4: { title: '另一筆 Saving，時間行落去會點？', subtitle: '呢度只展示 Saving 的官方已知價值。' }
  })[state.pageId] || null;
}

const SCENARIO_PAGES = {
  START: start,
  S2_TOOLS: scenario2Tools,
  S2_MARKET: scenario2Market,
  S2_MATURITY: scenario2Maturity,
  S2_MIXED: scenario2Mixed,
  S3_GOALS: scenario3Goals,
  S3_TRADEOFF: scenario3Tradeoff
};

function scenarioPage(pageId) { const body = SCENARIO_PAGES[pageId]; return body ? { body } : null; }

function start(state, official) {
  const entries = pageContent(official, 'START');
  return `<div class="scenario-grid" aria-label="選擇對話方向">${['scenario1', 'scenario2', 'scenario3'].map((key, index) => {
    const card = entries.find(item => item.action_key === key);
    return `<button class="ava-card ava-card--interactive scenario-card" data-action="select-scenario" data-value="${key}" data-card-id="${esc(card?.content_id || key)}" type="button"><span class="scenario-icon" aria-hidden="true">${['○','＋','△'][index]}</span><span><strong>${esc(card?.headline || '')}</strong><small>${esc(card?.subtext || '')}</small></span></button>`;
  }).join('')}</div><p class="quiet-note">你可以先講，我哋只係用呢個選擇幫手接住之後嘅畫面。</p>`;
}

function p1(state, official) { return `<div class="conversation-grid">${pageContent(official, 'P1').map(card => choice(card, 'method')).join('')}</div><p class="quiet-note">你可以先講，我哋只係用呢個選擇幫手接住之後嘅畫面。</p>`; }
function p2(state, official) { return `<div class="conversation-grid">${pageContent(official, 'P2').map(card => choice(card, 'purpose')).join('')}</div>`; }
function choice(card, kind) { return `<button class="ava-card ava-card--interactive" data-action="select-${kind}" data-value="${esc(card.action_key)}" data-card-id="${esc(card.content_id || card.action_key)}" type="button"><span class="card-icon" aria-hidden="true">${kind === 'method' ? '○' : '✦'}</span><span><strong>${esc(card.headline)}</strong><small>${esc(card.subtext)}</small></span></button>`; }

function scenario2Tools(state, official) {
  const selected = state.session.investmentTools || [];
  const cards = pageContent(official, 'S2_TOOLS');
  return `<div class="tool-grid">${INVESTMENT_TOOLS.map(([key, label, note]) => { const card = cards.find(item => item.action_key === key); return `<button class="tool-card ${selected.includes(key) ? 'is-selected' : ''}" data-action="toggle-investment-tool" data-value="${key}" data-card-id="${esc(card?.content_id || key)}" type="button" aria-pressed="${selected.includes(key)}"><span class="tool-symbol" aria-hidden="true">${selected.includes(key) ? '✓' : '○'}</span><strong>${esc(card?.headline || label)}</strong><small>${esc(card?.subtext || note)}</small></button>`; }).join('')}</div><p class="selection-count">${selected.length ? `已選 ${selected.length} 項` : '可以揀多過一項'}</p><div class="actions"><button class="ava-button ava-button--primary" data-action="continue-investment-tools" type="button" ${selected.length ? '' : 'disabled'}>睇下時間同市場會帶來咩考慮 →</button></div>`;
}

function scenario2Market(state) {
  const selected = state.session.marketResponse;
  const mixed = state.session.investmentTools?.some(key => key === 'stock' || key === 'etf') && state.session.investmentTools?.some(key => key === 'fixed_deposit' || key === 'bond');
  const marketLabels = (state.session.investmentTools || []).filter(key => key === 'stock' || key === 'etf').map(toolLabel).join(' ＋ ');
  const responses = [['hold','繼續持有','繼續參與市場'],['reduce','減低持倉','先降低一部分市場參與'],['wait','等穩定啲再決定','將決定留到另一個時間點']];
  return `<div class="visual-stage"><strong class="visual-kicker">${esc(marketLabels)} · 概念示意</strong><svg class="market-path" viewBox="0 0 600 180" role="img" aria-label="概念性的市場波動示意：100、112、125、103、94、108"><polyline class="market-path__line" points="35,120 140,87 245,48 350,112 455,140 560,98"/>${[[35,120],[140,87],[245,48],[350,112],[455,140],[560,98]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="7"/>`).join('')}</svg><div class="market-values" aria-hidden="true">${[100,112,125,103,94,108].map(value => `<span>${value}</span>`).join('')}</div><p class="visual-caption">數字只為展示上落，唔係歷史數據、預測或預期回報。需要用錢時，市場可能剛好較弱。</p></div><div class="response-grid" aria-label="市場波動時的想法">${responses.map(([key,label,note]) => `<button class="response-card ${selected === key ? 'is-selected' : ''}" data-action="select-market-response" data-value="${key}" type="button" aria-pressed="${selected === key}"><strong>${label}</strong><small>${note}</small></button>`).join('')}</div><p class="selection-note" role="status">${marketResponse(selected)}</p>${selected ? scenario2ResourceBridge(state, mixed ? 'continue-market-to-maturity' : 'continue-to-saving') : ''}`;
}

function marketResponse(value) { return value ? '呢度沒有正確答案。你需要用錢的時間，未必配合當時市場狀況。' : '揀一個你較自然的反應，感受一下時間點的影響。'; }
function scenario2Maturity(state) {
  const selected = state.session.maturityResponse;
  const bondOnly = state.session.investmentTools?.includes('bond') && !state.session.investmentTools.includes('fixed_deposit');
  const mixed = state.session.investmentTools?.some(key => key === 'stock' || key === 'etf') && state.session.investmentTools?.some(key => key === 'fixed_deposit' || key === 'bond');
  const maturityLabels = (state.session.investmentTools || []).filter(key => key === 'fixed_deposit' || key === 'bond').map(toolLabel).join(' ＋ ');
  const responses = [['renew', bondOnly ? '查看到期安排' : '續期'],['compare','再比較其他選擇'],['switch','轉另一種工具'],['later','到時先決定']];
  return `<div class="visual-stage"><strong class="visual-kicker">${esc(maturityLabels)} · ${bondOnly ? '如有到期日' : '到期時間線'}</strong><div class="maturity-visual"><div><b>今日</b><span>現有安排</span></div><i aria-hidden="true">→</i><div><b>${bondOnly ? '如有到期日' : '到期'}</b><span>再出現決定點</span></div><i aria-hidden="true">→</i><div><b>下一步？</b><span>按當時情況再選</span></div></div></div><div class="response-grid maturity-choices">${responses.map(([key,label]) => `<button class="response-card ${selected === key ? 'is-selected' : ''}" data-action="select-maturity-response" data-value="${key}" type="button" aria-pressed="${selected === key}"><strong>${label}</strong></button>`).join('')}</div><p class="selection-note" role="status">${selected ? '長期需要可能經過多次到期與再投資決定；實際條件要看當時的利率、產品條款及相關風險。' : '揀一個你會考慮的下一步，睇下時間線點樣延伸。'}</p>${selected ? `<div class="horizon-line" aria-label="長期時間線"><span>第1年</span><i>→</i><span>第2年</span><i>→</i><span>第5年</span><i>→</i><span>第10年</span><i>→</i><span>第15年</span></div>${scenario2ResourceBridge(state, mixed ? 'continue-maturity-to-mixed' : 'continue-to-saving')}` : ''}`;
}

function scenario2Mixed(state) { const selected = state.session.investmentTools || []; const market = selected.filter(key => key === 'stock' || key === 'etf').map(toolLabel).join(' ＋ '); const maturity = selected.filter(key => key === 'fixed_deposit' || key === 'bond').map(toolLabel).join(' ＋ '); const focus = state.session.mixedFocus; return `<div class="mixed-visual"><button class="mixed-lane ${focus === 'market' ? 'is-selected' : ''}" data-action="select-mixed-focus" data-value="market" type="button" aria-pressed="${focus === 'market'}"><strong>市場一邊 · ${esc(market)}</strong><span>價值波動，留意需要用錢的時間</span></button><button class="mixed-lane ${focus === 'maturity' ? 'is-selected' : ''}" data-action="select-mixed-focus" data-value="maturity" type="button" aria-pressed="${focus === 'maturity'}"><strong>到期一邊 · ${esc(maturity)}</strong><span>到期時，或要再作投資／儲蓄決定</span></button></div><p class="selection-note" role="status">${focus === 'market' ? '市場參與可以保留，但價值未必在需要使用時剛好有利。' : focus === 'maturity' ? '到期安排可以保留，但日後條款和再投資決定仍要重新看。' : '點選任何一邊，看看不同的時間考慮。'}</p><p class="visual-caption">債券仍有發行方及市場風險，定期條款亦要按實際產品看。</p>${scenario2ResourceBridge(state)}`; }
function scenario2ResourceBridge(state, action = 'continue-to-saving') { const selected = state.session.investmentTools || []; const market = selected.some(key => key === 'stock' || key === 'etf'); const maturity = selected.some(key => key === 'fixed_deposit' || key === 'bond'); const role = market && maturity ? '保留市場參與及到期型資源，各有不同考慮。' : market ? '繼續參與市場及其增長機會，同時承受波動。' : '保留較可預先了解條款或到期時間的角色，仍須留意相關風險。'; const nextLabel = action === 'continue-market-to-maturity' ? '睇埋到期之後可以點？ →' : action === 'continue-maturity-to-mixed' ? '睇下兩種考慮點樣共存 →' : '如果另外建立一筆 Saving，時間行落去會點？ →'; return `<div class="resource-bridge"><div class="resource-card"><span>現有安排</span><strong>${selected.map(toolLabel).map(esc).join(' ＋ ')}</strong><small>${role}</small></div><div class="bridge-plus" aria-hidden="true">＋</div><div class="resource-card resource-card--new"><span>另一筆預先規劃</span><strong>Saving</strong><small>${action === 'continue-to-saving' ? '建立另一條長期資源線；實際價值稍後按官方數據睇。' : '稍後再將兩種時間考慮放埋一齊睇。'}</small></div></div><p class="transition-note">未來資源未必要全部依賴同一個市場狀況或同一個到期決定。</p><div class="actions"><button class="ava-button ava-button--primary" data-action="${action}" type="button">${nextLabel}</button></div>`; }
function toolLabel(key) { return INVESTMENT_TOOLS.find(item => item[0] === key)?.[1] || key; }

function scenario3Goals(state) {
  const selected = state.session.scenarioGoals || [];
  return `<div class="triangle-wrap"><div class="goal-triangle" data-selected-count="${selected.length}" aria-label="三個可選特點的三角示意"><svg class="goal-triangle__shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,10 9,87 91,87"/></svg>${SCENARIO_GOALS.map(([key,label]) => `<button class="goal-point goal-point--${key} ${selected.includes(key) ? 'is-selected' : ''}" data-action="toggle-goal" data-value="${key}" type="button" aria-pressed="${selected.includes(key)}"><span>${label}</span></button>`).join('')}<div class="triangle-center">${selected.length ? `已選 ${selected.length} 項` : '揀你重視的角色'}</div></div></div><div class="goal-summary" role="status">${goalSummary(selected)}</div><div class="actions"><button class="ava-button ava-button--primary" data-action="continue-goals" type="button" ${selected.length ? '' : 'disabled'}>睇下呢幾個要求點樣取捨 →</button></div>`;
}
function goalSummary(selected) { if (!selected.length) return '你可以揀任何一項、兩項，或者三項。'; const labels = selected.map(key => SCENARIO_GOALS.find(item => item[0] === key)?.[1]); return `你重視：${labels.join(' ＋ ')}。${selected.length === 3 ? '同時追求三者，通常要接受角色之間的取捨。' : '下一步只會針對你揀選的角色來看。'}`; }
function scenario3Tradeoff(state) { const selected = state.session.scenarioGoals || []; const labels = selected.map(key => SCENARIO_GOALS.find(item => item[0] === key)?.[1]); return `<div class="tradeoff-visual" data-combination="${[...selected].sort().join('-')}"><div class="tradeoff-nodes">${SCENARIO_GOALS.filter(([key]) => selected.includes(key)).map(([, label]) => `<div class="tradeoff-node is-selected"><span aria-hidden="true">✓</span>${label}</div>`).join('<span class="tradeoff-join" aria-hidden="true">↔</span>')}</div><div class="tradeoff-line" role="status">${tradeoffMessage(selected)}</div></div><p class="transition-note">未必需要一件工具負責晒所有角色。${selected.length === 3 ? '同時重視三個方向，通常更需要取捨。' : ''}</p><div class="resource-bridge"><div class="resource-card"><span>你重視的特點</span><strong>${labels.join(' ＋ ')}</strong><small>先分清想要的角色；唔代表任何一種工具全面最好。</small></div><div class="bridge-plus" aria-hidden="true">＋</div><div class="resource-card resource-card--new"><span>一個可能的額外角色</span><strong>Saving</strong><small>預先規劃的長期資源；用真實官方數字了解安排。</small></div></div><div class="actions"><button class="ava-button ava-button--primary" data-action="continue-to-saving" type="button">用真實 Saving 數字繼續睇 →</button></div>`; }
function tradeoffMessage(selected) {
  const key = [...selected].sort().join('-');
  return ({
    stability: '偏重穩定／安心：安排通常較重視可預先了解的條件；仍要看條款及風險。',
    flexibility: '偏重靈活性：容易調整或使用的安排，可能改變長期累積的方式。',
    growth: '偏重增長潛力：較多市場參與通常伴隨價值波動。',
    'flexibility-stability': '想兼顧穩定／安心與靈活性：要留意使用時間、產品條款和調整空間之間的取捨。',
    'growth-stability': '想平衡穩定／安心與增長潛力：增長機會與價值波動並存，要看自己可接受的風險。',
    'flexibility-growth': '想兼顧靈活性與增長潛力：需要使用資源時，可能剛好遇上市場波動。',
    'flexibility-growth-stability': '三個方向都重要：單一工具通常難以同時最大化穩定、靈活和增長潛力。'
  })[key] || '先揀你重視的特點，再睇各種資源角色。';
}

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
  if (state.session.scenario === 'scenario2' || state.session.scenario === 'scenario3') return p3Scenario(state);
  const method = official.current_methods?.find(item => item.method_key === state.session.currentMethod);
  const path = currentPath({ method: state.session.currentMethod, amount: state.session.annualContribution, assumptions: state.session.assumptions });
  return `<div class="path-card"><div class="card-kicker">${esc(method?.display_name || '而家嘅做法')}</div><h2>${esc(method?.visual_title || '同一筆錢，時間耐咗會點？')}</h2><div class="metric-row"><div class="ava-metric"><span class="ava-label">每年安排金額</span><strong id="p3-annual-contribution-value" class="ava-metric__value">${money(state.session.annualContribution)}</strong><span class="ava-metric__unit">你輸入的金額</span></div><div class="ava-metric"><span class="ava-label">5年後現有方法預計有幾多</span><strong id="p3-current-path-value" class="ava-metric__value">${path.value == null ? '—' : money(path.value)}</strong><span id="p3-current-path-unit" class="ava-metric__unit">${path.kind === 'known' ? '按每年安排累積' : '按你輸入的假設'}</span></div><div id="p3-current-path-status" class="path-status path-status--${path.kind}">${esc(path.label)}</div></div></div>
    <div class="ava-card input-card"><label class="ava-label" for="annual-contribution">如果用同一筆錢，每年大概安排幾多？</label><div class="money-input"><span>HK$</span><input id="annual-contribution" data-field="annualContribution" inputmode="numeric" type="number" min="1" step="1000" value="${state.session.annualContribution || ''}" placeholder="例如 100000"></div><label class="ava-label field-inline" for="customer-age">你而家幾多歲？<input id="customer-age" data-field="currentAge" inputmode="numeric" type="number" min="0" max="120" step="1" value="${state.session.currentAge ?? ''}" placeholder="例如 40" required></label><p class="ava-help">只用於將時間點翻譯成歲數。</p>${state.session.ageError ? '<p class="ava-status ava-status--warning" role="alert">請先輸入目前歲數，時間軸才可以顯示正確歲數。</p>' : ''}${assumptionFields(state)}</div>
    <div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">加入時間後會係點 →</button></div>`;
}
function p3Scenario(state) {
  const context = state.session.scenario === 'scenario2' ? `你原有的 ${(state.session.investmentTools || []).map(toolLabel).map(esc).join(' ＋ ')} 可以保留；而家只輸入另一筆 Saving 的每年安排。` : '你已經整理好重視的特點；而家可以睇另一筆 Saving 的實際安排。';
  return `<div class="path-card"><div class="card-kicker">另一筆預先規劃的資源</div><h2>如果每年安排一筆錢，5 年之後點樣延伸？</h2><div class="ava-metric"><span class="ava-label">每年 Saving 安排</span><strong id="p3-annual-contribution-value" class="ava-metric__value">${money(state.session.annualContribution)}</strong><span class="ava-metric__unit">你輸入的金額；未作市場推算</span></div></div><p class="calculation-note">${context}</p><div class="ava-card input-card"><label class="ava-label" for="annual-contribution">每年大概安排幾多？</label><div class="money-input"><span>HK$</span><input id="annual-contribution" data-field="annualContribution" inputmode="numeric" type="number" min="1" step="1000" value="${state.session.annualContribution || ''}" placeholder="例如 100000"></div><label class="ava-label field-inline" for="customer-age">你而家幾多歲？<input id="customer-age" data-field="currentAge" inputmode="numeric" type="number" min="0" max="120" step="1" value="${state.session.currentAge ?? ''}" placeholder="例如 40" required></label><p class="ava-help">只用於將時間點翻譯成歲數。</p>${state.session.ageError ? '<p class="ava-status ava-status--warning" role="alert">請先輸入目前歲數，時間軸才可以顯示正確歲數。</p>' : ''}</div><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">睇下 Saving 時間線 →</button></div>`;
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
  const timeline = ageYearRail({ id: 'comparison-time-rail', items: years.map(year => ({ year })), selected: selectedYear, state });
  if (state.session.scenario === 'scenario2' || state.session.scenario === 'scenario3') return p4Scenario(state, official, selectedYear, timeline);
  const saving = calculateSavingPortfolio({ session: state.session, overallPolicyYear: selectedYear, official });
  const current = currentPath({ method: state.session.currentMethod, amount: state.session.annualContribution, assumptions: state.session.assumptions, projectionYears: selectedYear });
  const count = activeSavingPhases(state.session).length;
  return `<div class="comparison-intro">${count === 1 ? '同一筆每年安排<br><span>＋ 同一段時間</span>' : `現有 5 年安排<br><span>＋ 已選 ${count} 期 Saving</span>`}<br><strong>↓ 兩種方法最後有幾多</strong></div><div class="time-bar-card timeline-rail-card"><div class="time-bar-heading"><span>向左右探索時間</span><span>左右滑動查看更多</span></div>${timeline}</div><div class="comparison-stack"><div class="resource-card resource-card--current"><span class="card-kicker">現有方法</span><strong>${current.value == null ? '—' : money(current.value)}</strong><span>${esc(official.current_methods?.find(x => x.method_key === state.session.currentMethod)?.display_name || '而家嘅做法')} · ${current.value == null ? '請先輸入所需假設' : `到 ${selectedYear} 年`}</span></div><div class="plus">對比</div><div class="resource-card resource-card--new"><span class="card-kicker">Saving · ${count} 期安排</span><strong>${saving.available ? money(saving.futureValue) : '—'}</strong><span>${saving.available ? `到 ${selectedYear} 年` : esc(saving.message)}</span></div></div><p class="calculation-note">${count === 1 ? '時間軸按現有資料展示。' : `現有方法維持 5 年投入；Saving 按你已選的 ${count} 期安排計算。`}目前已包括 ${saving.availablePhaseCount} 期可顯示價值${saving.unavailablePhaseCount ? '；其他已開始期數的價值稍後再看' : ''}。</p><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">了解點樣運作 →</button></div>`;
}
function p4Scenario(state, official, selectedYear, timeline) {
  const saving = calculateSavingPortfolio({ session: state.session, overallPolicyYear: selectedYear, official });
  return `<div class="comparison-intro">另外建立一筆 Saving<br><span>時間行落去會點？</span></div><div class="time-bar-card timeline-rail-card"><div class="time-bar-heading"><span>向左右探索時間</span><span>左右滑動查看更多</span></div>${timeline}</div><div class="resource-card resource-card--new"><span class="card-kicker">Saving · ${saving.phases.length} 期安排</span><strong>${saving.available ? money(saving.futureValue) : '—'}</strong><span>${saving.available ? `到第 ${selectedYear} 年 · 按官方已知數據` : esc(saving.message)}</span></div><p class="calculation-note">只展示 Saving 的官方已知價值；沒有為現有工具或偏好虛構回報。</p><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">了解點樣運作 →</button></div>`;
}

function p5(state) {
  const phases = activeSavingPhases(state.session);
  const total = Number(state.session.annualContribution) * 5;
  const currentAge = getCustomerAge(state);
  const completionAge = ageAtPolicyYear(state, phases.length * 5);
  const cards = phases.map(phase => `<section class="ava-card saving-phase" data-saving-phase="${phase.id}"><div class="phase-heading"><h2>${phase.label} Saving</h2>${phase.id > 1 ? `<button class="ava-button ava-button--subtle" data-action="remove-saving-phase" data-phase-id="${phase.id}" type="button">${phase.id === 2 && phases.length === 3 ? '收起第二、三期' : `收起${phase.label}`}</button>` : ''}</div><p>第 ${phase.offset + 1}–${phase.offset + 5} 年</p><div class="phase-amounts"><span>每年安排 <strong>${money(state.session.annualContribution)}</strong></span><span>5 年總投入 <strong>${money(total)}</strong></span></div></section>`).join('<div class="phase-arrow" aria-hidden="true">↓</div>');
  return `<div class="phase-journey">${cards}</div>${phases.length < 3 ? `<div class="actions phase-add"><button class="ava-button ava-button--secondary" data-action="add-saving-phase" type="button">${phases.length === 1 ? '＋ 繼續下一個 5 年' : '＋ 再加入下一個 5 年'}</button></div>` : ''}<p class="calculation-note">每一期都係一份獨立的 5 年 Saving 安排。<br>目前歲數 ${currentAge == null ? '—' : `${currentAge}歲`} · 完成供款時歲數 ${completionAge == null ? '—' : `${completionAge}歲`}</p><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">探索時間 →</button></div>`;
}

function ageYearRail({ id, items, selected, state, action = 'select-year', context = '', selectedStrategy = null }) {
  if (!items.length) return '<p class="ava-status ava-status--warning">未有可用時間點。</p>';
  // Selection is deliberately excluded. Changed page/age/options/strategy is a new control.
  const scrollContext = JSON.stringify([state.pageId, getCustomerAge(state), action, context, items.map(item => [item.value ?? item.year, item.strategyCode || ''])]);
  return `<div id="${id}" class="timeline-rail" data-scroll-context="${esc(scrollContext)}" role="listbox" aria-label="年齡及 policy year">${items.map(item => {
    const age = ageAtPolicyYear(state, item.year);
    const isSelected = item.strategyCode ? item.strategyCode === selectedStrategy : item.year === selected;
    const strategy = item.strategyCode ? ` data-strategy-code="${esc(item.strategyCode)}"` : '';
    return `<button class="timeline-rail__item ${isSelected ? 'is-selected' : ''}" type="button" role="option" aria-selected="${isSelected}" data-action="${action}" data-value="${item.value ?? item.year}"${strategy}${item.phaseId ? ` data-phase-id="${item.phaseId}"` : ''}><strong>${item.strategyCode === 'none' ? '自動滾存' : age == null ? '—' : `${age}歲`}</strong><small>${item.strategyCode === 'none' ? '不提取' : `第 ${item.localYear ?? item.year}年${item.strategyCode ? '開始' : ''}`}</small></button>`;
  }).join('')}</div>`;
}

function p6(state, official) {
  const years = supportedYears(official, 'none');
  const selectedYear = years.includes(state.session.policyYear) ? state.session.policyYear : years[0];
  const result = calculateSavingPortfolio({ session: state.session, overallPolicyYear: selectedYear, official });
  const timeline = ageYearRail({ id: 'accumulation-time-rail', items: years.map(year => ({ year })), selected: selectedYear, state });
  return `<div class="anchor-metric"><span>到這個時間點已投入 · ${result.phases.length} 期安排</span><strong>${money(result.totalContribution)}</strong></div><div class="time-bar-card timeline-rail-card"><div class="time-bar-heading"><span>向左右探索年齡</span><span>左右滑動查看更多</span></div>${timeline}</div><div class="result-card"><span class="card-kicker">累積 Saving 價值 · ${ageAtPolicyYear(state, selectedYear) == null ? '—' : `${ageAtPolicyYear(state, selectedYear)}歲`}</span><strong>${result.available ? money(result.futureValue) : '—'}</strong><span>${result.available ? `目前已包括 ${result.availablePhaseCount} 期可顯示價值${result.unavailablePhaseCount ? ' · 其他已開始期數的價值稍後再看' : ''}` : esc(result.message)}</span></div><div class="actions"><button class="ava-button ava-button--secondary" data-action="next" type="button">探索使用方式 →</button></div>`;
}

function p7(state, official) {
  const points = phaseStrategyChoices(official);
  const { phases, result } = withdrawalPortfolio(state.session, official);
  const sections = phases.map(phase => {
    const id = phase.id === 1 ? 'withdrawal-start-rail' : `withdrawal-start-rail-${phase.id}`;
    const timeline = ageYearRail({ id, items: points.map(item => ({ year: item.strategy_code === 'none' ? null : phase.offset + item.policyYear, localYear: item.policyYear, value: item.strategy_code === 'none' ? 'none' : item.policyYear, strategyCode: item.strategy_code, phaseId: phase.id })), selected: phase.offset + phase.startYear, state, action: 'select-withdrawal-start', selectedStrategy: phase.strategyCode });
    const exploreId = phase.id === 1 ? 'withdrawal-explore-rail' : `withdrawal-explore-rail-${phase.id}`;
    const postTimeline = ageYearRail({ id: exploreId, items: phase.years.map(year => ({ year: phase.offset + year, localYear: year, value: year, phaseId: phase.id })), selected: phase.overallPolicyYear, state, action: 'select-withdrawal-year', context: phase.strategyCode });
    return `<section class="withdrawal-phase" data-withdrawal-phase="${phase.id}"><h2>${phase.label} — 幾時開始使用？</h2><div class="time-bar-card timeline-rail-card">${timeline}</div><h3>開始之後，時間行落去會點？</h3><div class="time-bar-card timeline-rail-card">${postTimeline}</div>${withdrawalMetrics(phase.result, false)}${phase.result.available ? '' : `<p class="ava-status ava-status--warning" role="status">${esc(phase.result.message)}</p>`}</section>`;
  }).join('');
  return `${sections}${phases.length > 1 ? `<section class="withdrawal-summary"><h2>整體效果</h2><p class="calculation-note">按以上各期目前選擇合計</p>${combinedWithdrawalMetrics(result)}${result.available ? '' : `<p class="ava-status ava-status--warning" role="status">${esc(result.message)}</p>`}</section>` : ''}<div class="actions"><button class="ava-button ava-button--primary" data-action="customer-view" type="button">一 click 睇客戶頁 →</button></div>`;
}

function withdrawalMetrics(result, combined = true) {
  const labels = combined ? ['合計每年可使用', '合計累積已使用', '合計戶口價值'] : ['每年可使用', '累積已使用', '當時戶口價值'];
  return `<div class="withdrawal-result">${['annualUsable', 'cumulativeUsed', 'remainingValue'].map((key, index) => `<div><span>${labels[index]}</span><strong data-${combined ? 'portfolio' : 'phase'}-metric="${key}">${result.available ? money(result[key]) : '—'}</strong></div>`).join('')}</div>`;
}

function combinedWithdrawalMetrics(result) { return withdrawalMetrics(result); }

function customerView(state, official, meta) {
  const { phases, result } = withdrawalPortfolio(state.session, official);
  const method = official.current_methods?.find(x => x.method_key === state.session.currentMethod)?.display_name || '現有安排';
  const scenario = state.session.scenario;
  const context = scenario === 'scenario2' ? (state.session.investmentTools || []).map(toolLabel).map(esc).join(' ＋ ') : scenario === 'scenario3' ? (state.session.scenarioGoals || []).map(key => SCENARIO_GOALS.find(item => item[0] === key)?.[1]).map(esc).join(' ＋ ') : esc(method);
  const contextLabel = scenario === 'scenario3' ? '你重視的特點' : '你而家嘅做法';
  const contextNote = scenario === 'scenario3' ? '只記錄你揀選的方向，不作產品評分。' : '保留現有選擇，不作未有資料的推算。';
  const lead = scenario === 'scenario3' ? '未必需要一件工具負責晒所有角色；Saving 可以係另一筆預先規劃的未來資源。' : scenario === 'scenario2' ? '現有工具可以繼續，同時看看另一筆 Saving 安排的官方已知價值。' : `原有 ${esc(method)} 可以繼續，同時多一筆可以預先規劃嘅未來資源。`;
  const generatedAt = new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
  const contribution = Number(state.session.annualContribution) * 5;
  const contributions = phases.map(phase => `<div class="customer-phase-row" data-contribution-phase="${phase.id}"><b>${phase.label}</b><small>每年 ${money(state.session.annualContribution)} · 供款 5 年<br>供款總額 ${money(contribution)}</small></div>`).join('');
  const arrangement = phases.map(phase => {
    const choice = phase.autoAccumulation ? '自動滾存' : phase.startYear == null ? '暫未有可用安排' : `第 ${phase.startYear} 年開始`;
    const age = ageAtPolicyYear(state, phase.overallPolicyYear);
    const metrics = phase.result.available ? `${phase.autoAccumulation ? '沒有提取' : `每年 ${money(phase.result.annualUsable)}`} · 累積已使用 ${money(phase.result.cumulativeUsed)}<br>戶口 ${money(phase.result.remainingValue)}` : '暫未有可顯示結果';
    return `<div class="customer-phase-row" data-customer-withdrawal-phase="${phase.id}"><b>${phase.label}：${choice}</b><small>探索第 ${phase.selectedYear ?? '—'} 年（${age == null ? '—' : `${age}歲`}）<br>${metrics}</small></div>`;
  }).join('');
  const summary = phases.length > 1 ? `<h2>整體效果</h2><p class="calculation-note">按以上各期目前選擇合計</p>${combinedWithdrawalMetrics(result)}` : '';

  return `<div class="customer-view" data-ava-mode="presentation"><div class="presentation-label">Customer Presentation · ${meta.stale ? '離線快取資料' : 'AVA Saving'}</div><h1>${scenario === 'scenario3' ? '你重視的方向' : '現有方法'} ＋ 新增安排<br><span>＝ 新嘅整體資源畫面</span></h1><p class="presentation-lead">${lead}</p><div class="customer-grid"><div class="customer-block"><span>${contextLabel}</span><strong>${context}</strong><small>${contextNote}</small></div><div class="customer-block customer-block--accent"><span>新增 Saving 安排 · ${phases.length} 期</span><strong>${result.available ? money(result.remainingValue) : '—'}</strong><small>${result.available ? phases.length > 1 ? '按各期目前選擇合計' : '按第一期目前選擇' : esc(result.message)}</small></div><div class="customer-block customer-block--phases"><span>各期供款安排</span>${contributions}${phases.length > 1 ? `<div class="customer-contribution-total"><span>合計供款</span><strong>${money(result.totalContribution)}</strong></div>` : ''}</div><div class="customer-block customer-block--phases"><span>各期使用安排</span>${arrangement}</div></div>${summary}<p class="disclosure">以上 Saving 數字按各期現有官方資料計算；客戶輸入的現有方法及任何假設會清楚分開展示。資料版本：${esc(official.version?.data_version || '未提供')}；生成日期：${generatedAt}。</p><div class="actions presentation-actions"><button class="ava-button ava-button--primary" data-action="print" type="button">匯出客戶頁 PDF</button><button class="ava-button ava-button--secondary" data-action="close-customer" type="button">返回對話</button></div></div>`;
}

function unavailable(message) { return `<div class="ava-status ava-status--warning">${esc(message)}</div>`; }
function renderEditPanel(app, state, page, title, subtitle) {
  const current = state.pageId;
  const cards = [...app.querySelectorAll(`[data-action="select-method"], [data-action="select-purpose"], [data-action="select-scenario"], [data-action="toggle-investment-tool"]`)].map((button, index) => ({ id: button.dataset.cardId, headline: button.querySelector('strong')?.textContent || '', subtext: button.querySelector('small')?.textContent || '', index }));
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
