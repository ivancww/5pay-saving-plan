import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const gasSource = fs.readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
const domains = ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view'];
const schemas = {
  flow: ['page_id', 'order', 'page_type', 'title', 'subtitle', 'enabled', 'skippable'],
  page_content: ['content_id', 'page_id', 'content_type', 'order', 'headline', 'subtext', 'action_key', 'enabled'],
  routing: ['route_id', 'method_key', 'reason_key', 'visualization_type', 'next_page', 'enabled'],
  current_methods: ['method_key', 'display_name', 'model_type', 'assumption_source', 'future_rule', 'visual_title', 'enabled'],
  withdrawal_strategies: ['strategy_code', 'display_name', 'start_year', 'withdraw_rate', 'sheet_name', 'enabled', 'sort_order'],
  customer_view: ['block_id', 'order', 'block_type', 'title', 'subtitle', 'enabled']
};

class Range {
  constructor(sheet, row, column, rows, columns) { this.sheet = sheet; this.row = row; this.column = column; this.rows = rows; this.columns = columns; }
  getValues() { return Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.columns }, (_, c) => this.sheet.valueAt(this.row + r, this.column + c))); }
  getFormulas() { return this.getValues().map(row => row.map(() => '')); }
  setValues(values) { values.forEach((row, r) => row.forEach((value, c) => this.sheet.setValueAt(this.row + r, this.column + c, value))); this.sheet.onSetValues?.(this); return this; }
  setValue(value) { this.sheet.setValueAt(this.row, this.column, value); return this; }
  clearContent() { for (let r = 0; r < this.rows; r += 1) for (let c = 0; c < this.columns; c += 1) this.sheet.setValueAt(this.row + r, this.column + c, ''); return this; }
  setFormula() { return this; }
}

class Sheet {
  constructor(name, values, onSetValues = null) { this.name = name; this.values = values.map(row => [...row]); this.onSetValues = onSetValues; }
  valueAt(row, column) { return this.values[row - 1]?.[column - 1] ?? ''; }
  setValueAt(row, column, value) { while (this.values.length < row) this.values.push([]); while (this.values[row - 1].length < column) this.values[row - 1].push(''); this.values[row - 1][column - 1] = value; }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(row, column, rows = 1, columns = 1) { return new Range(this, row, column, rows, columns); }
  getLastColumn() { return Math.max(1, ...this.values.map(row => row.length)); }
  getLastRow() { let last = 0; this.values.forEach((row, index) => { if (row.some(value => value !== '' && value !== null && value !== undefined)) last = index + 1; }); return Math.max(1, last); }
  getMaxRows() { return 1000; }
}

class TextOutput {
  constructor(value) { this.value = typeof value === 'string' ? value : JSON.stringify(value); }
  setMimeType() { return this; }
  getContentText() { return this.value; }
}

function sheetData(systemHeaders = ['block_id', 'order', 'block_type', 'title', 'subtitle', 'enabled']) {
  const rows = {
    flow: Array.from({ length: 7 }, (_, i) => ({ page_id: `P${i + 1}`, order: i + 1, page_type: 'conversation', title: `頁面 ${i + 1}`, subtitle: '說明', enabled: true, skippable: i === 1 })),
    page_content: [...Array.from({ length: 6 }, (_, i) => ({ content_id: `P1_C${i + 1}`, page_id: 'P1', content_type: 'choice', order: i + 1, headline: `P1 ${i + 1}`, subtext: '說明', action_key: `p1_${i + 1}`, enabled: true })), ...Array.from({ length: 6 }, (_, i) => ({ content_id: `P2_C${i + 1}`, page_id: 'P2', content_type: 'choice', order: i + 1, headline: `P2 ${i + 1}`, subtext: '說明', action_key: `p2_${i + 1}`, enabled: true }))],
    routing: [
      ['cash', '*', 'same_money'], ['none', '*', 'same_money'], ['fixed_deposit', '*', 'reinvestment_visibility'],
      ['investment', 'growth', 'market_future'], ['investment', 'flexibility', 'market_future'], ['investment', 'future', 'market_use_timing'],
      ['investment', 'income', 'market_future'], ['investment', 'stability', 'market_use_timing'], ['investment', 'none', 'market_future'],
      ['bond', '*', 'bond_continuity'], ['long_term', '*', 'existing_plan']
    ].map(([method_key, reason_key, visualization_type], i) => ({ route_id: `R${String(i + 1).padStart(3, '0')}`, method_key, reason_key, visualization_type, next_page: 'P4', enabled: true })),
    current_methods: [
      ['cash', '銀行 / 現金', 'principal_only', 'none', 'known', '同一筆錢'], ['none', '未有特別安排', 'principal_only', 'none', 'known', '同一筆錢'],
      ['fixed_deposit', '定期', 'principal_only', 'official', 'maturity', '到期之後'], ['investment', '股票 / ETF', 'market_linked', 'official', 'market', '市場變化'],
      ['bond', '債券', 'fixed_income', 'official', 'maturity', '收息安排'], ['long_term', '已有長期安排', 'existing_plan', 'user', 'existing', '已有安排']
    ].map(([method_key, display_name, model_type, assumption_source, future_rule, visual_title]) => ({ method_key, display_name, model_type, assumption_source, future_rule, visual_title, enabled: true })),
    withdrawal_strategies: [
      ['none', '不提取', '', 0, '自動滾存'], ['withdraw7_from8', '8年後提取', 8, 0.07, '8年領取'], ['withdraw12_from15', '15年後提取', 15, 0.12, '15年領取'],
      ['withdraw18_from20', '20年後提取', 20, 0.18, '20年領取'], ['withdraw23_from25', '25年後提取', 25, 0.23, '25年領取'], ['withdraw29_from30', '30年後提取', 30, 0.29, '30年領取']
    ].map(([strategy_code, display_name, start_year, withdraw_rate, sheet_name], i) => ({ strategy_code, display_name, start_year, withdraw_rate, sheet_name, enabled: true, sort_order: i + 1 })),
    customer_view: Array.from({ length: 6 }, (_, i) => ({ block_id: `CV0${i + 1}`, order: i + 1, block_type: ['current_method', 'contribution', 'future_value', 'withdrawal', 'summary', 'disclosure'][i], title: `展示區塊 ${i + 1}`, subtitle: '說明', enabled: true }))
  };
  const headers = Object.fromEntries(Object.entries(schemas).map(([domain, fields]) => [domain, fields]));
  const sheets = {};
  Object.entries(rows).forEach(([domain, values]) => { sheets[domain] = new Sheet(domain, [headers[domain], ...values.map(row => headers[domain].map(key => row[key]))]); });
  // This mirrors the read-only production workbook: Saving_System is not a
  // key/value metadata table and must never be treated as a write target.
  const sheetNames = { flow: 'Saving_Flow', page_content: 'Saving_Page_Content', routing: 'Saving_Routing', current_methods: 'Saving_Current_Methods', withdrawal_strategies: 'Saving_Withdrawal_Strategies', customer_view: 'Saving_Customer_View' };
  domains.forEach(domain => { sheets[sheetNames[domain]] = sheets[domain]; delete sheets[domain]; });
  const systemRows = systemHeaders[0] === 'key'
    ? [systemHeaders, ['module_name', 'Saving'], ['data_version', '1.0.0'], ['last_updated', new Date('2026-01-01T00:00:00.000Z')]]
    : [systemHeaders, ['CV01', 1, 'current_method', '你而家嘅做法', '由今日嘅安排開始睇。', true]];
  sheets.Saving_System = new Sheet('Saving_System', systemRows);
  const returnRows = [['policy_year', 'withdrawal_rate', 'multiplier'], [8, 0, 1.16], [15, 0, 1.86]];
  ['自動滾存', '8年領取', '15年領取', '20年領取', '25年領取', '30年領取'].forEach(name => { sheets[name] = new Sheet(name, returnRows); });
  return sheets;
}

function createContext(sheets) {
  const active = { sheets };
  const context = {
    console,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    isFinite,
    crypto,
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: value => new TextOutput(value) },
    SpreadsheetApp: { getActive: () => ({ getSheetByName: name => active.sheets[name] }), getActiveSpreadsheet: () => ({ getSheetByName: name => active.sheets[name] }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'https://platform.invalid' }) },
    CacheService: { getScriptCache: () => ({ remove: () => {} }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => [...crypto.createHash('sha256').update(value).digest()] },
    UrlFetchApp: { fetch: (_, options) => {
      const body = JSON.parse(options.payload);
      const ok = body.adminSessionProof !== 'bad';
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(ok ? { success: true, appId: '5pay', operation: body.operation, contract: 'ava-admin-session-v1', expiresAt: new Date(Date.now() + 3600000).toISOString() } : { success: false, error: 'invalid session' }) };
    } }
  };
  vm.createContext(context);
  vm.runInContext(gasSource, context, { filename: 'Code.gs' });
  return context;
}

function responseValue(output) { return JSON.parse(output.getContentText()); }
function get(context, action) { return responseValue(context.doGet({ parameter: { action } })); }
function post(context, body) { return responseValue(context.doPost({ postData: { contents: JSON.stringify(body) } })); }
function publishBody(data, expectedVersion, overrides = {}) {
  return { action: 'publish_content', adminSessionProof: 'proof', appId: '5pay', operation: '5pay:official-write:configuration', expectedVersion, data, ...overrides };
}
function editableData(bootstrap) { return Object.fromEntries(domains.map(domain => [domain, structuredClone(bootstrap.data[domain])])); }

test('full six-domain publish succeeds with production-shaped protected Saving_System', () => {
  const context = createContext(sheetData());
  const before = get(context, 'bootstrap');
  const data = editableData(before);
  data.page_content[0].headline = '已確認的新標題';
  const result = post(context, publishBody(data, before.data.revision));
  assert.equal(result.success, true);
  assert.equal(result.persisted, true);
  assert.equal(result.read_after_write, true);
  assert.equal(result.server_metadata.last_updated_persisted, false);
  assert.equal(result.last_updated, '');
  for (const domain of domains) assert.deepEqual(result.data[domain], data[domain]);
  assert.match(result.revision, /^[0-9a-f]{64}$/);
  assert.notEqual(result.revision, before.data.revision);
  assert.deepEqual(result.data.system, {});
  assert.deepEqual(get(context, 'bootstrap').data.page_content, data.page_content);
});

test('protected Saving_System cannot be submitted as a publish domain', () => {
  const context = createContext(sheetData());
  const before = get(context, 'bootstrap');
  const data = editableData(before);
  data.system = [];
  const result = post(context, publishBody(data, before.data.revision));
  assert.equal(result.success, false);
  assert.match(result.error, /Unknown publish domain: system/);
});

test('security and identity negatives fail before mutation', () => {
  const context = createContext(sheetData());
  const before = get(context, 'bootstrap');
  const data = editableData(before);
  const duplicate = structuredClone(data);
  duplicate.page_content.push(structuredClone(duplicate.page_content[0]));
  assert.match(post(context, publishBody(duplicate, before.data.revision)).error, /Duplicate page_content identity/);
  assert.match(post(context, publishBody(data, 'f'.repeat(64))).error, /Stale Official data version/);
  assert.match(post(context, publishBody(data, before.data.revision, { adminSessionProof: 'bad' })).error, /invalid session/);
  assert.match(post(context, publishBody(data, before.data.revision, { appId: 'wrong' })).error, /Invalid App ID/);
  const protectedField = structuredClone(data);
  protectedField.flow[0].last_updated = 'attacker';
  assert.match(post(context, publishBody(protectedField, before.data.revision)).error, /Protected or unknown flow.last_updated/);
});

test('read-after-write mismatch rolls back all touched domains', () => {
  const sheets = sheetData();
  let tampered = false;
  sheets.Saving_Page_Content.onSetValues = () => { if (!tampered) { tampered = true; sheets.Saving_Page_Content.values[1][4] = 'tampered after write'; } };
  const context = createContext(sheets);
  const before = get(context, 'bootstrap');
  const data = editableData(before);
  data.page_content[0].headline = 'should roll back';
  const result = post(context, publishBody(data, before.data.revision));
  assert.equal(result.success, false);
  assert.match(result.error, /Read-after-write verification failed/);
  assert.deepEqual(get(context, 'bootstrap').data.page_content, before.data.page_content);
});

test('valid key/value metadata remains server-owned and is updated only by the server', () => {
  const sheets = sheetData(['key', 'value']);
  const context = createContext(sheets);
  const before = get(context, 'bootstrap');
  const data = editableData(before);
  const result = post(context, publishBody(data, before.data.revision));
  assert.equal(result.success, true);
  assert.equal(result.server_metadata.last_updated_persisted, true);
  assert.match(result.last_updated, /^2026-|^20/);
  assert.notEqual(result.data.system.last_updated, undefined);
});
