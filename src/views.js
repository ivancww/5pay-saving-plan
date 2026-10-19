import { activeSavingPhases, calculateExistingResourceProjection, calculateFairPrincipalComparison, calculateSavingPortfolio, currentInstrumentSummary, currentPath, supportedYears, phaseStrategyChoices, withdrawalPortfolio } from './calculation.js';
import { ageAtPolicyYear, effectiveAnnualContribution, getCustomerAge } from './state.js';
import { MEDIA_TYPES, mediaCanRender, mediaFallbackLabel, normalizeMediaList } from './media.js';
import { INVESTMENT_TOOLS, SCENARIO_GOALS } from './scenario-flow.js';
import { formatMoneyInput, normalizeMoneyValue } from './money.js';
import { marketHistoryKeys, normalizedMarketSeries, simulateMarketHistory } from './scenario2-market-history.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
export function formatCustomerMoney(value) { const parsed = normalizeMoneyValue(value); return parsed == null ? '—' : `HK$ ${Math.round(parsed).toLocaleString('en-US')}`; }
const money = formatCustomerMoney;
const inputMoney = value => formatMoneyInput(value);
const pct = value => `${(Number(value) * 100).toFixed(Number(value) % 0.01 ? 1 : 0)}%`;
function growthAbovePrincipal(total, principal) {
  const value = normalizeMoneyValue(total);
  const base = normalizeMoneyValue(principal);
  return value == null || base == null ? null : value - base;
}
function comparisonRows({ existingLabel, existingValue, annualArrangement, growth, total }) {
  return `<div class='comparison-detail'><span>${existingLabel}</span><strong>${existingValue == null ? '—' : money(existingValue)}</strong></div><div class='comparison-detail'><span>每年安排</span><strong>${annualArrangement == null ? '—' : money(annualArrangement)}</strong></div><div class='comparison-detail'><span>累積增長</span><strong>${growth == null ? '—' : money(growth)}</strong></div><div class='comparison-card-total'><span>總額</span><strong>${total == null ? '—' : money(total)}</strong></div>`;
}
function instrumentP4Card({ method, methodName, current, resource, selectedYear }) {
  const isBond = method === 'bond';
  const instrumentLabel = isBond ? '債券' : '定期存款';
  const amountLabel = isBond ? '債券金額' : '定期金額';
  const termLabel = isBond ? '距離到期' : '年期';
  const resourceRate = resource.rate == null ? '未輸入' : `${(resource.rate * 100).toLocaleString('zh-HK')}%`;
  const resourceSection = `<div class='instrument-p4-section resource-section'><span class='card-kicker'>現有存款安排 · 以第${selectedYear}年計算</span><div class='comparison-detail'><span>現有存款</span><strong>${resource.existingDeposit == null ? '—' : money(resource.existingDeposit)}</strong></div><div class='comparison-detail'><span>每年存放</span><strong>${resource.annualContribution == null ? '—' : money(resource.annualContribution)}</strong></div><div class='comparison-detail'><span>存款利息</span><strong>${resourceRate}</strong></div><div class='comparison-card-total'><span>累積結果</span><strong>${resource.available ? money(resource.value) : '—'}</strong></div></div>`;
  const instrumentSection = current.details.length
    ? `<div class='instrument-p4-section resource-section'><span class='card-kicker'>今期${instrumentLabel}</span>${current.details.map((item, index) => {
      const detailLabel = current.details.length > 1 ? `第${index + 1}筆${instrumentLabel}` : instrumentLabel;
      const growth = item.value - item.principal;
      return `<div class='instrument-p4-detail'><strong>${detailLabel}</strong><div class='comparison-detail'><span>${amountLabel}</span><strong>${money(item.principal)}</strong></div><div class='comparison-detail'><span>${termLabel}</span><strong>${item.termYears}年</strong></div><div class='comparison-detail'><span>年息</span><strong>${pct(item.annualRate)}</strong></div><div class='comparison-detail'><span>今期累積增長</span><strong>${money(growth)}</strong></div><div class='comparison-card-total'><span>今期到期金額</span><strong>${money(item.value)}</strong></div></div>`;
    }).join('')}</div>`
    : `<div class='instrument-p4-section resource-section'><span class='card-kicker'>今期${instrumentLabel}</span><p class='calculation-note'>尚未輸入${instrumentLabel}資料。</p></div>`;
  return `<div class='resource-card resource-card--current p4-comparison-card p4-instrument-card'><span class='card-kicker'>現有方法 · ${esc(methodName)}</span>${resourceSection}${instrumentSection}<small>今期到期金額可以計到；到期之後下一期息率同條件，就要到時先知道。</small></div>`;
}
const pageContent = (official, pageId) => official?.page_content?.filter(item => item.page_id === pageId) || [];

export function getExistingResourceFutureValue(current) {
  const bankValue = normalizeMoneyValue(current?.breakdown?.existingDepositFutureValue);
  if (bankValue != null) return bankValue;
  const values = (current?.details || []).map(item => normalizeMoneyValue(item?.value)).filter(value => value != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}


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
    P3: { title: '如果另外建立一筆複利儲蓄安排？', subtitle: '先輸入每年安排金額，之後再睇官方已知數字。' },
    P4: { title: '另一筆複利儲蓄安排，時間行落去會點？', subtitle: '呢度只展示複利儲蓄安排的官方已知價值。' }
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

function marketSelection(state) {
  const tools = state.session.investmentTools || [];
  const keys = marketHistoryKeys({ stocks: tools.includes('stock'), etfs: tools.includes('etf') });
  const activeKey = keys.includes(state.session.marketHistorySeries) ? state.session.marketHistorySeries : keys[0];
  const series = normalizedMarketSeries(activeKey);
  const years = series?.observations.map(item => item.year) || [];
  const startYear = years.includes(String(state.session.marketStartYear)) ? String(state.session.marketStartYear) : years[0];
  const endYear = years.includes(String(state.session.marketEndYear)) ? String(state.session.marketEndYear) : years[years.length - 1];
  return { tools, keys, activeKey, series, years, startYear, endYear };
}

const signedMoney = value => {
  const parsed = normalizeMoneyValue(Math.abs(Number(value)));
  return parsed == null ? '—' : `${Number(value) >= 0 ? '+' : '-'}HK$ ${Math.round(parsed).toLocaleString('en-US')}`;
};

const signedPercent = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed >= 0 ? '+' : ''}${parsed.toFixed(1)}%` : '—';
};

export function marketSimulatorResult(state) {
  const { activeKey, series, startYear, endYear } = marketSelection(state);
  const result = simulateMarketHistory({
    seriesKey: activeKey,
    principal: state.session.marketPrincipal,
    startYear,
    endYear
  });
  if (!result.available) {
    return `<div class="market-simulator-result__empty" role="status">請輸入本金，並選擇較後的需要使用年份，先睇歷史模擬結果。</div>`;
  }
  const basis = series?.kind === 'index'
    ? '按歷史指數變化模擬，不代表實際基金回報。'
    : '按現有歷史價格／價格回報資料模擬；不包括未納入資料基礎的派息。';
  return `<div class="market-simulator-result__main"><span>歷史模擬結果</span><strong>${money(result.simulatedValue)}</strong></div>
    <dl class="market-result-list">
      <div><dt>投入本金</dt><dd>${money(result.principal)}</dd></div>
      <div><dt>由</dt><dd>${esc(result.startYear)} → ${esc(result.endYear)}</dd></div>
      <div><dt>盈利／虧損</dt><dd>${signedMoney(result.profitLoss)}</dd></div>
      <div><dt>歷史變化</dt><dd>${signedPercent(result.returnPercent)}</dd></div>
    </dl>
    <p class="market-result-basis">${esc(basis)}</p>`;
}

function scenario2Market(state) {
  const { tools, keys, activeKey, series, years, startYear, endYear } = marketSelection(state);
  const mixed = tools.some(key => key === 'stock' || key === 'etf') && tools.some(key => key === 'fixed_deposit' || key === 'bond');
  const values = series?.observations || [];
  const min = Math.min(...values.map(item => item.normalized));
  const max = Math.max(...values.map(item => item.normalized));
  const points = values.map((item, index) => {
    const x = 28 + (index * 544 / Math.max(1, values.length - 1));
    const y = 106 - ((item.normalized - min) / Math.max(1, max - min)) * 78;
    return { ...item, x: x.toFixed(1), y: y.toFixed(1) };
  });
  const startPoint = points.find(item => item.year === startYear) || points[0];
  const endPoint = points.find(item => item.year === endYear) || points[points.length - 1];
  const selectorLabel = tools.includes('stock') && tools.includes('etf') ? '市場指數／ETF例子' : tools.includes('etf') ? 'ETF例子' : '股票市場';
  const disclosure = `歷史數據至 ${String(series?.dataThroughDate || '—').slice(0, 4)} 年底 · 資料核對日期 ${series?.verifiedAt || '—'} · 歷史表現不代表未來 · 未計匯率影響。 ${series?.displayBasis || ''}`;
  return `<div class="visual-stage visual-stage--market-simulator" data-market-simulator>
    <div class="market-simulator-heading">
      <strong class="visual-kicker">過去10年，實際行過點？</strong>
      <small>${esc(series?.shortLabel || '市場歷史參考')} · 以起點 = 100 作歷史走勢比較</small>
    </div>
    <div class="history-series-tabs market-selector" role="tablist" aria-label="${esc(selectorLabel)}">
      ${keys.map(key => { const item = normalizedMarketSeries(key); return `<button class="year-chip ${key === activeKey ? 'is-selected' : ''}" data-action="select-market-history-series" data-value="${key}" type="button" role="tab" aria-selected="${key === activeKey}">${esc(item?.shortLabel || key)}</button>`; }).join('')}
    </div>
    <svg class="market-path market-path--compact" viewBox="0 0 600 120" role="img" aria-label="${esc(series?.label || '市場歷史走勢')}：以起點等於100">
      <polyline class="market-path__line" points="${points.map(point => `${point.x},${point.y}`).join(' ')}"/>
      ${points.map(point => `<circle class="market-point" data-market-point-year="${point.year}" cx="${point.x}" cy="${point.y}" r="3.5"/>`).join('')}
      <circle class="market-marker market-marker--start" data-market-marker="start" cx="${startPoint?.x || 28}" cy="${startPoint?.y || 106}" r="6"/>
      <circle class="market-marker market-marker--end" data-market-marker="end" cx="${endPoint?.x || 572}" cy="${endPoint?.y || 106}" r="6"/>
    </svg>
    <div class="market-simulator-controls">
      <label class="ava-label">本金<div class="money-input"><span>HK$</span><input data-market-principal data-money-input inputmode="numeric" type="text" value="${inputMoney(state.session.marketPrincipal)}" placeholder="100000"></div></label>
      <label class="ava-label">參與年份<select class="ava-input" data-market-start>${years.map(year => `<option value="${year}" ${year === startYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label>
      <label class="ava-label">需要使用年份<select class="ava-input" data-market-end>${years.map(year => `<option value="${year}" ${year === endYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label>
    </div>
    <div data-market-result>${marketSimulatorResult(state)}</div>
    <section class="market-reflection" aria-label="歷史結果反思">
      <strong>歷史行完，我哋可以睇到結果；但如果今日開始，未來需要用錢嗰一年，結果又可唔可以預先知道？</strong>
      <p>歷史數據可以計算過去，但未來市場結果無法預先確定。</p>
    </section>
    <details class="market-source"><summary>資料來源 ⓘ</summary><small>${esc(series?.primarySource?.name || '已核對的歷史資料')} · 資料期間 ${years[0] || '—'}–${years[years.length - 1] || '—'}</small></details>
    <p class="history-disclosure">${esc(disclosure)}</p>
    ${simulateMarketHistory({ seriesKey: activeKey, principal: state.session.marketPrincipal, startYear, endYear }).available ? scenario2ResourceBridge(state, mixed ? 'continue-market-to-maturity' : 'continue-scenario2-to-saving') : ''}
  </div>`;
}
function scenario2Maturity(state) {
  const selected = state.session.maturityResponse;
  const bondOnly = state.session.investmentTools?.includes('bond') && !state.session.investmentTools.includes('fixed_deposit');
  const mixed = state.session.investmentTools?.some(key => key === 'stock' || key === 'etf') && state.session.investmentTools?.some(key => key === 'fixed_deposit' || key === 'bond');
  const maturityLabels = (state.session.investmentTools || []).filter(key => key === 'fixed_deposit' || key === 'bond').map(toolLabel).join(' ＋ ');
  const responses = [['renew', bondOnly ? '查看到期安排' : '續期'],['compare','再比較其他選擇'],['switch','轉另一種工具'],['later','到時先決定']];
  return `<div class="visual-stage"><strong class="visual-kicker">${esc(maturityLabels)} · ${bondOnly ? '如有到期日' : '到期時間線'}</strong><div class="maturity-visual"><div><b>今日</b><span>現有安排</span></div><i aria-hidden="true">→</i><div><b>${bondOnly ? '如有到期日' : '到期'}</b><span>再出現決定點</span></div><i aria-hidden="true">→</i><div><b>下一步？</b><span>按當時情況再選</span></div></div></div><div class="response-grid maturity-choices">${responses.map(([key,label]) => `<button class="response-card ${selected === key ? 'is-selected' : ''}" data-action="select-maturity-response" data-value="${key}" type="button" aria-pressed="${selected === key}"><strong>${label}</strong></button>`).join('')}</div><p class="selection-note" role="status">${selected ? '長期需要可能經過多次到期與再投資決定；實際條件要看當時的利率、產品條款及相關風險。' : '揀一個你會考慮的下一步，睇下時間線點樣延伸。'}</p>${selected ? `<div class="horizon-line" aria-label="長期時間線">${[1, 2, 5, 10, 15].map(year => `<button class="year-chip ${Number(state.session.maturityHorizon) === year ? 'is-selected' : ''}" data-action="select-maturity-horizon" data-value="${year}" type="button" aria-pressed="${Number(state.session.maturityHorizon) === year}">第${year}年</button>`).join('')}</div>${scenario2ResourceBridge(state, mixed ? 'continue-maturity-to-mixed' : 'continue-scenario2-to-saving')}` : ''}`;
}

function scenario2Mixed(state) { const selected = state.session.investmentTools || []; const market = selected.filter(key => key === 'stock' || key === 'etf').map(toolLabel).join(' ＋ '); const maturity = selected.filter(key => key === 'fixed_deposit' || key === 'bond').map(toolLabel).join(' ＋ '); const focus = state.session.mixedFocus; return `<div class="mixed-visual"><button class="mixed-lane ${focus === 'market' ? 'is-selected' : ''}" data-action="select-mixed-focus" data-value="market" type="button" aria-pressed="${focus === 'market'}"><strong>市場一邊 · ${esc(market)}</strong><span>價值波動，留意需要用錢的時間</span></button><button class="mixed-lane ${focus === 'maturity' ? 'is-selected' : ''}" data-action="select-mixed-focus" data-value="maturity" type="button" aria-pressed="${focus === 'maturity'}"><strong>到期一邊 · ${esc(maturity)}</strong><span>到期時，或要再作投資／儲蓄決定</span></button></div><p class="selection-note" role="status">${focus === 'market' ? '市場參與可以保留，但價值未必在需要使用時剛好有利。' : focus === 'maturity' ? '到期安排可以保留，但日後條款和再投資決定仍要重新看。' : '點選任何一邊，看看不同的時間考慮。'}</p><p class="visual-caption">債券仍有發行方及市場風險，定期條款亦要按實際產品看。</p>${scenario2ResourceBridge(state)}`; }
function scenario2ResourceBridge(state, action = 'continue-scenario2-to-saving') { const selected = state.session.investmentTools || []; const market = selected.some(key => key === 'stock' || key === 'etf'); const maturity = selected.some(key => key === 'fixed_deposit' || key === 'bond'); const role = market && maturity ? '保留市場參與及到期型資源，各有不同考慮。' : market ? '繼續參與市場及其增長機會，同時承受波動。' : '保留較可預先了解條款或到期時間的角色，仍須留意相關風險。'; const nextLabel = action === 'continue-market-to-maturity' ? '睇埋到期之後可以點？ →' : action === 'continue-maturity-to-mixed' ? '睇下兩種考慮點樣共存 →' : '如果另外建立一筆複利儲蓄安排，時間行落去會點？ →'; return `<div class="resource-bridge"><div class="resource-card"><span>現有安排</span><strong>${selected.map(toolLabel).map(esc).join(' ＋ ')}</strong><small>${role}</small></div><div class="bridge-plus" aria-hidden="true">＋</div><div class="resource-card resource-card--new"><span>另一筆預先規劃</span><strong>複利儲蓄安排</strong><small>${action === 'continue-scenario2-to-saving' ? '建立另一條長期資源線；實際價值稍後按官方數據睇。' : '稍後再將兩種時間考慮放埋一齊睇。'}</small></div></div><p class="transition-note">投資／現有安排可以繼續；另一筆未來資源未必要同一時間受市場升跌或到期時點影響。</p><div class="actions"><button class="ava-button ava-button--primary" data-action="${action}" type="button">${nextLabel}</button></div>`; }
function toolLabel(key) { return INVESTMENT_TOOLS.find(item => item[0] === key)?.[1] || key; }

function scenario3Goals(state) {
  const selected = state.session.scenarioGoals || [];
  return `<div class="triangle-wrap"><div class="goal-triangle" data-selected-count="${selected.length}" aria-label="三個可選特點的三角示意"><svg class="goal-triangle__shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,10 9,87 91,87"/></svg>${SCENARIO_GOALS.map(([key,label]) => `<button class="goal-point goal-point--${key} ${selected.includes(key) ? 'is-selected' : ''}" data-action="toggle-goal" data-value="${key}" type="button" aria-pressed="${selected.includes(key)}"><span>${label}</span></button>`).join('')}<div class="triangle-center">${selected.length ? `已選 ${selected.length} 項` : '揀你重視的角色'}</div></div></div><div class="goal-summary" role="status">${goalSummary(selected)}</div><div class="actions"><button class="ava-button ava-button--primary" data-action="continue-goals" type="button" ${selected.length ? '' : 'disabled'}>睇下呢幾個要求點樣取捨 →</button></div>`;
}
function goalSummary(selected) { if (!selected.length) return '你可以揀任何一項、兩項，或者三項。'; const labels = selected.map(key => SCENARIO_GOALS.find(item => item[0] === key)?.[1]); return `你重視：${labels.join(' ＋ ')}。${selected.length === 3 ? '同時追求三者，通常要接受角色之間的取捨。' : '下一步只會針對你揀選的角色來看。'}`; }
function scenario3Tradeoff(state) { const selected = state.session.scenarioGoals || []; const labels = selected.map(key => SCENARIO_GOALS.find(item => item[0] === key)?.[1]); return `<div class="tradeoff-visual" data-combination="${[...selected].sort().join('-')}"><div class="tradeoff-nodes">${SCENARIO_GOALS.filter(([key]) => selected.includes(key)).map(([, label]) => `<div class="tradeoff-node is-selected"><span aria-hidden="true">✓</span>${label}</div>`).join('<span class="tradeoff-join" aria-hidden="true">↔</span>')}</div><div class="tradeoff-line" role="status">${tradeoffMessage(selected)}</div></div><p class="transition-note">未必需要一件工具負責晒所有角色。${selected.length === 3 ? '同時重視三個方向，通常更需要取捨。' : ''}</p><div class="resource-bridge"><div class="resource-card"><span>你重視的特點</span><strong>${labels.join(' ＋ ')}</strong><small>先分清想要的角色；唔代表任何一種工具全面最好。</small></div><div class="bridge-plus" aria-hidden="true">＋</div><div class="resource-card resource-card--new"><span>一個可能的額外角色</span><strong>複利儲蓄安排</strong><small>預先規劃的長期資源；用真實官方數字了解安排。</small></div></div><div class="actions"><button class="ava-button ava-button--primary" data-action="continue-scenario3-to-saving" type="button">用真實複利儲蓄安排數字繼續睇 →</button></div>`; }
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
  return `<div class="ava-card custom-page-content">${mediaContent}<p class="custom-page-support">${esc(page.content || '這是一頁只在本機保存的對話內容，不會改動官方複利儲蓄安排數據。')}</p><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">繼續 →</button></div></div>`;
}

function imageGrid(media) {
  if (!media.length) return mediaUnavailable();
  return `<div class="ava-media-grid ava-media-grid--${media.length}" aria-label="圖片內容">${media.map(item => mediaCanRender(item) ? `<figure class="ava-media-frame"><img src="${esc(item.cloudFileRef)}" alt="${esc(item.altText || item.title || '複利儲蓄安排圖片')}" loading="lazy"><figcaption>${esc(item.title)}</figcaption></figure>` : mediaUnavailable()).join('')}</div>`;
}
function videoPlayer(media) {
  if (!media || !mediaCanRender(media)) return mediaUnavailable();
  return `<div class="ava-video-frame"><video controls preload="metadata" playsinline src="${esc(media.cloudFileRef)}"></video></div>`;
}
function mediaUnavailable() { return `<div class="ava-media-fallback" role="status"><strong>${mediaFallbackLabel()}</strong><span>請重新連結雲端媒體後再試。</span><button class="ava-button ava-button--subtle" data-action="reconnect-media" type="button">重新連結</button></div>`; }

function p3(state, official) {
  if (state.session.scenario === 'scenario2' || state.session.scenario === 'scenario3') return p3Scenario(state);
  if (state.session.currentMethod === 'fixed_deposit' || state.session.currentMethod === 'bond') return p3Instrument(state, official);
  const method = official.current_methods?.find(item => item.method_key === state.session.currentMethod);
  const annualContribution = effectiveAnnualContribution(state.session);
  const path = currentPath({ method: state.session.currentMethod, amount: annualContribution, assumptions: state.session.assumptions, projectionYears: 8 });
  return `<div class='path-card'><div class='card-kicker'>${esc(method?.display_name || '而家嘅做法')}</div><h2>${esc(method?.visual_title || '同一筆錢，時間耐咗會點？')}</h2><div class='metric-row'><div class='ava-metric'><span class='ava-label'>每年存款安排</span><strong id='p3-annual-contribution-value' class='ava-metric__value'>${money(annualContribution)}</strong><span class='ava-metric__unit'>之後每年再安排的金額</span></div><div class='ava-metric'><span class='ava-label'>8年後現有方法預計有幾多</span><strong id='p3-current-path-value' class='ava-metric__value'>${path.value == null ? '—' : money(path.value)}</strong><span id='p3-current-path-unit' class='ava-metric__unit'>${path.kind === 'known' ? '按現有資料展示' : '按你輸入的假設'}</span></div><div id='p3-current-path-status' class='path-status path-status--${path.kind}'>${esc(path.label)}</div></div></div><div class='ava-card input-card'><div class='input-section input-section--new'><h3>之後新增安排</h3><label class='ava-label' for='annual-contribution'>之後每年大概安排幾多？</label><div class='money-input'><span>HK$</span><input id='annual-contribution' data-field='annualContribution' data-money-input inputmode='numeric' type='text' value='${inputMoney(state.session.annualContribution)}' placeholder='例如 100000'></div></div><label class='ava-label field-inline' for='customer-age'>你而家幾多歲？<input id='customer-age' data-field='currentAge' inputmode='numeric' type='number' min='0' max='120' step='1' value='${state.session.currentAge ?? ''}' placeholder='例如 40' required></label><p class='ava-help'>只用於將時間點翻譯成歲數。</p>${state.session.ageError ? '<p class="ava-status ava-status--warning" role="alert">請先輸入目前歲數，時間軸才可以顯示正確歲數。</p>' : ''}${assumptionFields(state)}</div><div class='actions'><button class='ava-button ava-button--primary' data-action='next' type='button'>加入時間後會係點 →</button></div>`;
}
function p3Instrument(state, official) {
  const method = state.session.currentMethod;
  const isBond = method === 'bond';
  const label = isBond ? '債券' : '定期存款';
  const amountLabel = isBond ? '債券金額' : '定期金額';
  const termLabel = isBond ? '距離到期' : '年期';
  const summary = currentInstrumentSummary({ method, assumptions: state.session.assumptions });
  const annualContribution = effectiveAnnualContribution(state.session);
  const existingResource = calculateExistingResourceProjection({
    existingDeposit: state.session.assumptions?.existingDeposit,
    cashRate: state.session.assumptions?.cashRate,
    annualContribution,
    projectionYears: 8
  });
  const term = summary.termYears == null ? (summary.details.length > 1 ? '各筆按輸入' : '—') : `${summary.termYears}年`;
  const rate = summary.annualRate == null ? (summary.details.length > 1 ? '各筆按輸入' : '—') : `${(summary.annualRate * 100).toLocaleString('zh-HK')}%`;
  const maturity = summary.available ? money(summary.value) : '—';
  const top = `<div class='path-card instrument-summary'><div class='card-kicker'>${label}</div><h2>今期知道，下一期又會點？</h2><div class='metric-row instrument-summary-grid'><div class='ava-metric'><span class='ava-label'>${amountLabel}</span><strong id='p3-instrument-principal-value' class='ava-metric__value'>${summary.principal == null ? '—' : money(summary.principal)}</strong></div><div class='ava-metric'><span class='ava-label'>${termLabel}</span><strong id='p3-instrument-term-value' class='ava-metric__value'>${term}</strong></div><div class='ava-metric'><span class='ava-label'>年息</span><strong id='p3-instrument-rate-value' class='ava-metric__value'>${rate}</strong></div><div class='ava-metric'><span class='ava-label'>今期到期金額</span><strong id='p3-current-path-value' class='ava-metric__value'>${maturity}</strong><span id='p3-current-path-unit' class='ava-metric__unit'>今期到期金額；到期後條件要到時再知道。</span></div></div><div id='p3-current-path-status' class='path-status path-status--${summary.available ? 'known' : 'unknown'}'>${summary.available ? '今期到期金額按目前本金、年期及年息計算。' : '輸入定期／債券資料後，可以睇到今期到期金額。'}</div><p class='calculation-note'>今期到期金額可以計到；到期之後下一期息率同條件，就要到時先知道。</p></div>`;
  const resource = `<section class='resource-summary-card' id='p3-existing-resource-summary'><h3>現有存款安排</h3><div class='resource-summary-grid'><div><span>現有存款</span><strong id='p3-existing-resource-principal-value'>${inputMoney(state.session.assumptions?.existingDeposit) ? money(state.session.assumptions.existingDeposit) : '—'}</strong></div><div><span>每年存放</span><strong id='p3-existing-resource-annual-value'>${money(annualContribution)}</strong></div><div><span>利息</span><strong id='p3-existing-resource-rate-value'>${state.session.assumptions?.cashRate == null || state.session.assumptions?.cashRate === '' ? '未輸入' : `${esc(state.session.assumptions.cashRate)}%`}</strong></div><div><span>累積結果</span><strong id='p3-existing-resource-value'>${existingResource.available ? money(existingResource.value) : '—'}</strong><small>以第${existingResource.projectionYears}年作資源示意</small></div></div></section>`;
  const inputs = `<div class='ava-card input-card'><div class='input-section input-section--existing'><h3>現有存款</h3><label class='ava-label' for='existing-deposit'>現有存款金額<div class='money-input'><span>HK$</span><input id='existing-deposit' data-assumption='existing-deposit' data-money-input inputmode='numeric' type='text' value='${inputMoney(state.session.assumptions?.existingDeposit)}' placeholder='例如 200000'></div></label><label class='ava-label field-inline' for='cash-rate'>現有存款利息（可留空）<span><input id='cash-rate' data-assumption='cash-rate' type='number' min='0' step='0.1' value='${esc(state.session.assumptions?.cashRate ?? '')}'> %</span></label><p class='ava-help'>現有存款及每年存放按呢個利息假設計算，與${label}年息分開。</p></div><div class='input-section input-section--existing'><h3>${label}</h3>${holdingEditor(isBond ? 'bonds' : 'fixedDeposits', label, termLabel, state.session.assumptions?.[isBond ? 'bonds' : 'fixedDeposits'], amountLabel)}</div>${resource}<div class='input-section input-section--new'><h3>每年存放</h3><label class='ava-label' for='annual-contribution'>之後每年大概存放幾多？</label><div class='money-input'><span>HK$</span><input id='annual-contribution' data-field='annualContribution' data-money-input inputmode='numeric' type='text' value='${inputMoney(state.session.annualContribution)}' placeholder='例如 100000'></div></div><label class='ava-label field-inline' for='customer-age'>你而家幾多歲？<input id='customer-age' data-field='currentAge' inputmode='numeric' type='number' min='0' max='120' step='1' value='${state.session.currentAge ?? ''}' placeholder='例如 40' required></label><p class='ava-help'>每年存放是獨立的新增安排，不會自動加入今期${label}到期金額。</p></div>`;
  return `${top}${inputs}<div class='actions'><button class='ava-button ava-button--primary' data-action='next' type='button'>加入時間後會係點 →</button></div>`;
}

function p3Scenario(state) {
  const annualContribution = effectiveAnnualContribution(state.session);
  const context = state.session.scenario === 'scenario2' ? `你原有的 ${(state.session.investmentTools || []).map(toolLabel).map(esc).join(' ＋ ')} 可以保留；而家只輸入另一筆複利儲蓄安排的每年安排。` : '你已經整理好重視的特點；而家可以睇另一筆複利儲蓄安排的實際安排。';
  return `<div class='path-card'><div class='card-kicker'>另一筆預先規劃的資源</div><h2>如果每年安排一筆錢，5 年之後點樣延伸？</h2><div class='ava-metric'><span class='ava-label'>每年存款安排</span><strong id='p3-annual-contribution-value' class='ava-metric__value'>${money(annualContribution)}</strong><span class='ava-metric__unit'>你輸入的金額；未作市場推算</span></div></div><p class='calculation-note'>${context}</p><div class='ava-card input-card'><div class='input-section input-section--new'><h3>之後新增安排</h3><label class='ava-label' for='annual-contribution'>每年大概安排幾多？</label><div class='money-input'><span>HK$</span><input id='annual-contribution' data-field='annualContribution' data-money-input inputmode='numeric' type='text' value='${inputMoney(state.session.annualContribution)}' placeholder='例如 100000'></div></div><label class='ava-label field-inline' for='customer-age'>你而家幾多歲？<input id='customer-age' data-field='currentAge' inputmode='numeric' type='number' min='0' max='120' step='1' value='${state.session.currentAge ?? ''}' placeholder='例如 40' required></label><p class='ava-help'>只用於將時間點翻譯成歲數。</p>${state.session.ageError ? '<p class="ava-status ava-status--warning" role="alert">請先輸入目前歲數，時間軸才可以顯示正確歲數。</p>' : ''}</div><div class='actions'><button class='ava-button ava-button--primary' data-action='next' type='button'>睇下複利儲蓄安排時間線 →</button></div>`;
}
function assumptionFields(state) {
  const assumptions = state.session.assumptions || {};
  if (state.session.currentMethod === 'cash') return `<div class='assumption-group input-section input-section--existing'><h3>目前已有資源</h3><label class='ava-label' for='existing-deposit'>銀行存款<div class='money-input'><span>HK$</span><input id='existing-deposit' data-assumption='existing-deposit' data-money-input inputmode='numeric' type='text' value='${inputMoney(assumptions.existingDeposit)}' placeholder='例如 500000'></div></label><label class='ava-label field-inline' for='cash-rate'>銀行年息（可留空）<span><input id='cash-rate' data-assumption='cash-rate' type='number' min='0' step='0.1' value='${esc(assumptions.cashRate ?? '')}'> %</span></label><p class='ava-help'>呢筆係目前已經存落嘅金額，唔係之後每年再安排嘅金額。</p></div>`;
  if (state.session.currentMethod === 'fixed_deposit') return `<div class='input-section input-section--existing'><h3>目前已有資源</h3>${holdingEditor('fixedDeposits', '定期存款', '年期', assumptions.fixedDeposits)}</div>`;
  if (state.session.currentMethod === 'bond') return `<div class='input-section input-section--existing'><h3>目前已有資源</h3>${holdingEditor('bonds', '債券', '距離到期', assumptions.bonds)}</div>`;
  if (state.session.currentMethod === 'investment') return field('customer-return-rate', '客戶假設年回報（可留空）', assumptions.returnRate ?? '', '%');
  if (state.session.currentMethod === 'long_term') return field('existing-value', '現有安排金額（可留空）', assumptions.existingValue ?? '', 'HK$');
  return '';
}

function holdingEditor(method, label, termLabel, holdings, amountLabel = method === 'bond' ? '債券金額' : '定期金額') {
  const items = Array.isArray(holdings) && holdings.length ? holdings : [{ id: `${method}-1`, principal: null, termYears: null, annualRate: null }];
  return `<div class='holding-editor' data-holding-method='${method}'><p class='ava-label'>${label}</p>${items.map((item, index) => `<div class='holding-card'><label class='ava-label'>${amountLabel}<div class='money-input'><span>HK$</span><input data-holding-method='${method}' data-holding-index='${index}' data-holding-field='principal' data-money-input inputmode='numeric' type='text' min='0' step='1000' value='${inputMoney(item.principal)}' placeholder='例如 300000'></div></label><label class='ava-label field-inline'>${termLabel}<span><input data-holding-method='${method}' data-holding-index='${index}' data-holding-field='termYears' type='number' min='0' step='1' value='${esc(item.termYears ?? '')}' placeholder='例如 2'> 年</span></label><label class='ava-label field-inline'>年息<span><input data-holding-method='${method}' data-holding-index='${index}' data-holding-field='annualRate' type='number' min='0' step='0.1' value='${esc(item.annualRate ?? '')}' placeholder='例如 3.5'> %</span></label>${index > 0 ? `<button class='ava-button ava-button--subtle holding-remove' data-action='remove-holding' data-holding-method='${method}' data-holding-index='${index}' type='button'>移除</button>` : ''}</div>`).join('')}<button class='ava-button ava-button--secondary' data-action='add-holding' data-holding-method='${method}' type='button'>＋ 新增</button></div>`;
}
function field(id, label, value, suffix) {
  const moneyField = suffix === 'HK$';
  return `<label class='ava-label field-inline' for='${id}'>${label}<span><input id='${id}' data-assumption='${id}' ${moneyField ? "data-money-input inputmode='numeric' type='text'" : "type='number'"} min='0' step='${moneyField ? '1000' : '0.1'}' value='${moneyField ? inputMoney(value) : esc(value)}'> ${suffix}</span></label>`;
}
function currentMethodBreakdown(current) {
  if (current.breakdown?.existingDepositFutureValue != null) return `<div class='current-method-breakdown'><div><span>現有存款增長後</span><strong>${money(current.breakdown.existingDepositFutureValue)}</strong></div><div><span>＋ 之後每年安排累積</span><strong>${money(current.breakdown.futureAnnualValue)}</strong></div><small>${esc(current.breakdown.label)}</small></div>`;
  if (!current.details?.length) return '';
  return `<div class='current-method-breakdown'>${current.details.map(item => `<div><span>${item.matured ? '已到期資金' : '現有本金'}</span><strong>${money(item.value)}</strong></div>`).join('')}</div>`;
}

function p4(state, official) {
  const years = supportedYears(official, 'none');
  const selectedYear = years.includes(state.session.policyYear) ? state.session.policyYear : years[0];
  const selectedAge = ageAtPolicyYear(state, selectedYear);
  const timeline = ageYearRail({ id: 'comparison-time-rail', items: years.map(year => ({ year })), selected: selectedYear, state });
  if (state.session.scenario === 'scenario2' || state.session.scenario === 'scenario3') return p4Scenario(state, official, selectedYear, timeline);
  const saving = calculateSavingPortfolio({ session: state.session, overallPolicyYear: selectedYear, official });
  const annualContribution = effectiveAnnualContribution(state.session);
  const maturityMethod = state.session.currentMethod === 'fixed_deposit' || state.session.currentMethod === 'bond';
  const current = maturityMethod ? null : currentPath({ method: state.session.currentMethod, amount: annualContribution, assumptions: state.session.assumptions, projectionYears: selectedYear });
  const horizon = `${selectedAge == null ? '—' : `${selectedAge}歲`} · 第 ${selectedYear} 年`;
  const method = official.current_methods?.find(item => item.method_key === state.session.currentMethod);
  const methodName = method?.display_name || '現有方法';
  const existingDeposit = normalizeMoneyValue(state.session.assumptions?.existingDeposit);
  const currentExisting = maturityMethod ? null : existingDeposit ?? (current.details?.reduce((sum, item) => sum + (normalizeMoneyValue(item.principal) || 0), 0) || null);
  const fair = state.session.currentMethod === 'cash'
    ? calculateFairPrincipalComparison({ existingDeposit, cashRate: state.session.assumptions?.cashRate, annualContribution, projectionYears: selectedYear, official })
    : null;
  const resource = maturityMethod
    ? calculateExistingResourceProjection({ existingDeposit, cashRate: state.session.assumptions?.cashRate, annualContribution, projectionYears: selectedYear })
    : null;
  const currentRows = maturityMethod ? '' : fair
    ? comparisonRows({ existingLabel: '現有存款', existingValue: existingDeposit == null ? null : fair.bankExistingPrincipal, annualArrangement: fair.bankAnnualPrincipal, growth: fair.bankGrowth, total: fair.bankTotal })
    : comparisonRows({ existingLabel: '現有資源', existingValue: currentExisting, annualArrangement: annualContribution, growth: growthAbovePrincipal(current.value, (currentExisting || 0) + (annualContribution || 0)), total: current.value });
  const savingRows = fair
    ? comparisonRows({ existingLabel: '現有存款', existingValue: fair.savingBankPrincipal, annualArrangement: fair.savingContributionPrincipal, growth: fair.savingGrowth, total: fair.savingTotal })
    : comparisonRows({ existingLabel: '現有存款', existingValue: saving.totalContribution, annualArrangement: annualContribution, growth: growthAbovePrincipal(saving.available ? saving.futureValue : null, saving.totalContribution || 0), total: saving.available ? saving.futureValue : null });
  const currentCard = maturityMethod
    ? instrumentP4Card({ method: state.session.currentMethod, methodName, current: currentInstrumentSummary({ method: state.session.currentMethod, assumptions: state.session.assumptions }), resource, selectedYear })
    : `<div class='resource-card resource-card--current p4-comparison-card'><span class='card-kicker'>現有方法 · ${esc(methodName)}</span>${currentRows}<small>${esc(current.label || '按目前輸入資料展示。')}</small></div>`;
  const savingCard = `<div class='resource-card resource-card--new p4-comparison-card'><span class='card-kicker'>複利儲蓄安排</span>${savingRows}<small>${saving.available ? '按官方已有數值展示，沒有插值。' : esc(saving.message)}</small></div>`;
  return `<div class='comparison-intro'><strong>以 ${horizon} 作比較</strong></div><div class='time-bar-card timeline-rail-card'><div class='time-bar-heading'><span>向左右探索時間</span><span>左右滑動查看更多</span></div>${timeline}</div><div class='comparison-stack p4-simple-comparison'>${currentCard}<div class='plus'>對比</div>${savingCard}</div><p class='calculation-note'>現有資源及新增安排分開展示；複利儲蓄安排只使用官方已有數值。</p><div class='actions'><button class='ava-button ava-button--primary' data-action='next' type='button'>了解點樣運作 →</button></div>`;
}
function p4Scenario(state, official, selectedYear, timeline) {
  const saving = calculateSavingPortfolio({ session: state.session, overallPolicyYear: selectedYear, official });
  return `<div class="comparison-intro">另外建立一筆複利儲蓄安排<br><span>時間行落去會點？</span></div><div class="time-bar-card timeline-rail-card"><div class="time-bar-heading"><span>向左右探索時間</span><span>左右滑動查看更多</span></div>${timeline}</div><div class="resource-card resource-card--new"><span class="card-kicker">複利儲蓄安排 · ${saving.phases.length} 期安排</span><strong>${saving.available ? money(saving.futureValue) : '—'}</strong><span>${saving.available ? `到第 ${selectedYear} 年 · 按官方已知數據` : esc(saving.message)}</span></div><p class="calculation-note">只展示複利儲蓄安排的官方已知價值；沒有為現有工具或偏好虛構回報。</p><div class="actions"><button class="ava-button ava-button--primary" data-action="next" type="button">了解點樣運作 →</button></div>`;
}

function p5(state) {
  const phases = activeSavingPhases(state.session);
  const currentAge = getCustomerAge(state);
  const completionAge = ageAtPolicyYear(state, phases.length * 5);
  const cards = phases.map(phase => {
    const amount = Number(phase.annualContribution);
    const total = Number.isFinite(amount) && amount > 0 ? amount * 5 : null;
    const years = Array.from({ length: 5 }, (_, index) => phase.offset + index + 1);
    const amountControl = phase.id === 1 ? `<strong class='phase-amount-value'>${money(amount)}</strong>` : `<div class='money-input phase-amount-input'><span>HK$</span><input data-phase-annual='${phase.id}' data-money-input inputmode='numeric' type='text' value='${inputMoney(amount)}' placeholder='例如 80000' aria-label='${phase.label}每年安排'></div>`;
    return `<section class='ava-card saving-phase' data-saving-phase='${phase.id}'><div class='phase-heading'><h2>${phase.label} 複利儲蓄安排</h2>${phase.id > 1 ? `<button class='ava-button ava-button--subtle' data-action='remove-saving-phase' data-phase-id='${phase.id}' type='button'>${phase.id === 2 && phases.length === 3 ? '收起第二、三期' : `收起${phase.label}`}</button>` : ''}</div><div class='phase-flow'><div class='phase-step'><span class='phase-step-number'>1</span><div><span>每年安排</span>${amountControl}</div></div><div class='phase-flow-arrow' aria-hidden='true'>↓</div><div class='phase-step'><span class='phase-step-number'>2</span><div><span>${years.map(year => `第${year}年`).join(' → ')}</span><small>連續 5 年的安排時間</small></div></div><div class='phase-flow-arrow' aria-hidden='true'>↓</div><div class='phase-step'><span class='phase-step-number'>3</span><div><span>5年總投入</span><strong data-phase-total='${phase.id}'>${money(total)}</strong></div></div></div></section>`;
  }).join('<div class="phase-arrow" aria-hidden="true">↓</div>');
  return `<div class='phase-journey'>${cards}</div>${phases.length < 3 ? `<div class='actions phase-add'><button class='ava-button ava-button--secondary' data-action='add-saving-phase' type='button'>${phases.length === 1 ? '＋ 繼續下一個 5 年' : '＋ 再加入下一個 5 年'}</button></div>` : ''}<p class='calculation-note'>每一期都係一份獨立的 5 年複利儲蓄安排。<br>目前歲數 ${currentAge == null ? '—' : `${currentAge}歲`} · 完成供款時歲數 ${completionAge == null ? '—' : `${completionAge}歲`}</p><div class='actions'><button class='ava-button ava-button--primary' data-action='next' type='button'>探索時間 →</button></div>`;
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
  const age = ageAtPolicyYear(state, selectedYear);
  return `<div class="anchor-metric"><span>截至呢個時間點已安排 · ${age == null ? '—' : `${age}歲`} · 第${selectedYear}年</span><strong>${money(result.totalContribution)}</strong><small>按各期實際供款時間計算</small></div><div class="time-bar-card timeline-rail-card"><div class="time-bar-heading"><span>向左右探索年齡</span><span>左右滑動查看更多</span></div>${timeline}</div><div class="result-card"><span class="card-kicker">複利儲蓄安排價值 · ${age == null ? '—' : `${age}歲`}</span><strong>${result.available ? money(result.futureValue) : '—'}</strong><span>${result.available ? `目前先顯示已有官方數值的 ${result.availablePhaseCount} 期${result.unavailablePhaseCount ? '；其他已開始期數稍後再看' : ''}` : esc(result.message)}</span></div><div class="actions"><button class="ava-button ava-button--secondary" data-action="next" type="button">探索使用方式 →</button></div>`;
}
function p7(state, official) {
  if (state.session.scenario !== 'scenario1') return p7Legacy(state, official);
  const points = phaseStrategyChoices(official);
  const { phases, result } = withdrawalPortfolio(state.session, official);
  const sections = phases.map(phase => {
    const id = phase.id === 1 ? 'withdrawal-start-rail' : `withdrawal-start-rail-${phase.id}`;
    const timeline = ageYearRail({ id, items: points.map(item => ({ year: item.strategy_code === 'none' ? null : phase.offset + item.policyYear, localYear: item.policyYear, value: item.strategy_code === 'none' ? 'none' : item.policyYear, strategyCode: item.strategy_code, phaseId: phase.id })), selected: phase.offset + phase.startYear, state, action: 'select-withdrawal-start', selectedStrategy: phase.strategyCode });
    const exploreId = phase.id === 1 ? 'withdrawal-explore-rail' : `withdrawal-explore-rail-${phase.id}`;
    const postTimeline = ageYearRail({ id: exploreId, items: phase.years.map(year => ({ year: phase.offset + year, localYear: year, value: year, phaseId: phase.id })), selected: phase.overallPolicyYear, state, action: 'select-withdrawal-year', context: phase.strategyCode });
    return `<section class="withdrawal-phase" data-withdrawal-phase="${phase.id}"><h2>${phase.label} — 幾時開始使用？</h2><div class="time-bar-card timeline-rail-card">${timeline}</div><h3>開始之後，時間行落去會點？</h3><div class="time-bar-card timeline-rail-card">${postTimeline}</div>${withdrawalMetrics(phase.result, false)}${phase.result.available ? '' : `<p class="ava-status ava-status--warning" role="status">${esc(phase.result.message)}</p>`}</section>`;
  }).join('');
  return `${sections}${phases.length > 1 ? `<section class='withdrawal-summary'><h2>整體效果</h2><p class='calculation-note'>按以上各期目前選擇合計</p>${combinedWithdrawalMetrics(result)}${result.available ? '' : `<p class='ava-status ava-status--warning' role='status'>${esc(result.message)}</p>`}</section>` : ''}<p class='calculation-note p7-summary-note'>以上各期結果已按目前使用設定整理；詳細數值見各期及整體效果。</p><div class='actions p7-summary-actions'><button class='ava-button ava-button--primary' data-action='customer-view' type='button'>一 click 睇客戶頁 →</button></div>`;
}

function p7Legacy(state, official) {
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
  const lead = scenario === 'scenario3' ? '未必需要一件工具負責晒所有角色；複利儲蓄安排可以係另一筆預先規劃的未來資源。' : scenario === 'scenario2' ? '現有工具可以繼續，同時看看另一筆複利儲蓄安排的官方已知價值。' : `原有 ${esc(method)} 可以繼續，同時多一筆可以預先規劃嘅未來資源。`;
  const generatedAt = new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
  const contributions = phases.map(phase => { const amount = Number(phase.annualContribution); const total = Number.isFinite(amount) && amount > 0 ? amount * 5 : null; return `<div class="customer-phase-row" data-contribution-phase="${phase.id}"><b>${phase.label}</b><small>每年 ${money(amount)} · 供款 5 年<br>供款總額 ${money(total)}</small></div>`; }).join('');
  const arrangement = phases.map(phase => {
    const choice = phase.autoAccumulation ? '自動滾存' : phase.startYear == null ? '暫未有可用安排' : `第 ${phase.startYear} 年開始`;
    const age = ageAtPolicyYear(state, phase.overallPolicyYear);
    const metrics = phase.result.available ? `${phase.autoAccumulation ? '沒有提取' : `每年 ${money(phase.result.annualUsable)}`} · 累積已使用 ${money(phase.result.cumulativeUsed)}<br>戶口 ${money(phase.result.remainingValue)}` : '暫未有可顯示結果';
    return `<div class="customer-phase-row" data-customer-withdrawal-phase="${phase.id}"><b>${phase.label}：${choice}</b><small>探索第 ${phase.selectedYear ?? '—'} 年（${age == null ? '—' : `${age}歲`}）<br>${metrics}</small></div>`;
  }).join('');
  const summary = phases.length > 1 ? `<h2>整體效果</h2><p class="calculation-note">按以上各期目前選擇合計</p>${combinedWithdrawalMetrics(result)}` : '';

  return `<div class="customer-view" data-ava-mode="presentation"><div class="presentation-label">Customer Presentation · ${meta.stale ? '離線快取資料' : 'AVA Saving'}</div><h1>${scenario === 'scenario3' ? '你重視的方向' : '現有方法'} ＋ 新增安排<br><span>＝ 新嘅整體資源畫面</span></h1><p class="presentation-lead">${lead}</p><div class="customer-grid"><div class="customer-block"><span>${contextLabel}</span><strong>${context}</strong><small>${contextNote}</small></div><div class="customer-block customer-block--accent"><span>複利儲蓄安排 · ${phases.length} 期</span><strong>${result.available ? money(result.remainingValue) : '—'}</strong><small>${result.available ? `${phases.length}期合計戶口價值 · 按各期目前使用設定` : esc(result.message)}</small></div><div class="customer-block customer-block--phases"><span>各期供款安排</span>${contributions}${phases.length > 1 ? `<div class="customer-contribution-total"><span>合計供款</span><strong>${money(result.totalContribution)}</strong></div>` : ''}</div><div class="customer-block customer-block--phases"><span>各期使用安排</span>${arrangement}</div></div>${summary}<p class="disclosure">以上複利儲蓄安排數字按各期現有官方資料計算；客戶輸入的現有方法及任何假設會清楚分開展示。資料版本：${esc(official.version?.data_version || '未提供')}；生成日期：${generatedAt}。</p><div class="actions presentation-actions customer-summary-actions" data-summary-actions="right"><button class="ava-button ava-button--primary" data-action="print" type="button">匯出客戶頁 PDF</button><button class="ava-button ava-button--secondary" data-action="close-customer" type="button">返回對話</button></div></div>`;
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
  app.insertAdjacentHTML('beforeend', '<section class="edit-panel ava-card preview-panel" aria-label="前台預覽"><h2>前台預覽</h2><p class="quiet-note">以下就是客戶會看到的複利儲蓄安排前台；目前修改尚未儲存。</p><div class="actions"><button class="ava-button ava-button--secondary" data-action="return-edit" type="button">返回編輯</button><button class="ava-button ava-button--primary" data-action="save-preview" type="button">儲存本機設定</button></div></section>');
}
