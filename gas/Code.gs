/**
 * 5PAY Saving Official GAS Web App.
 *
 * This is the source-controlled Saving backend. Configure the deployment with
 * AVA_PLATFORM_ADMIN_ENDPOINT (the AVA Platform GAS Web App URL). No Saving
 * password or Google-account allowlist is used here.
 */
const APP_ID = '5pay';
const PLATFORM_ENDPOINT_PROPERTY = 'AVA_PLATFORM_ADMIN_ENDPOINT';
const BOOTSTRAP_CACHE_KEY = 'saving_bootstrap_v1';
const RETURN_SHEETS = ['自動滾存', '8年領取', '15年領取', '20年領取', '25年領取', '30年領取'];
const WRITE_DOMAINS = ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies', 'customer_view'];
const SHEETS = Object.freeze({
  flow: 'Saving_Flow', page_content: 'Saving_Page_Content', routing: 'Saving_Routing',
  current_methods: 'Saving_Current_Methods', withdrawal_strategies: 'Saving_Withdrawal_Strategies',
  customer_view: 'Saving_Customer_View', system: 'Saving_System'
});
const SCHEMAS = Object.freeze({
  flow: ['page_id','order','page_type','title','subtitle','enabled','skippable'],
  page_content: ['content_id','page_id','content_type','order','headline','subtext','action_key','enabled'],
  routing: ['route_id','method_key','reason_key','visualization_type','next_page','enabled'],
  current_methods: ['method_key','display_name','model_type','assumption_source','future_rule','visual_title','enabled'],
  withdrawal_strategies: ['strategy_code','display_name','start_year','withdraw_rate','sheet_name','enabled','sort_order'],
  customer_view: ['block_id','order','block_type','title','subtitle','enabled']
});
const STRATEGY_SHEETS = Object.freeze({
  none: '自動滾存', withdraw7_from8: '8年領取', withdraw12_from15: '15年領取',
  withdraw18_from20: '20年領取', withdraw23_from25: '25年領取', withdraw29_from30: '30年領取'
});

function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function fail_(message) { throw new Error(message); }

function doGet(e) {
  try {
    const action = String(e.parameter.action || '');
    if (action === 'bootstrap') return json_({ ok: true, data: readBootstrap_() });
    if (action === 'content') return json_({ ok: true, data: readContent_() });
    if (action === 'returns') return json_({ ok: true, data: readReturnTables_() });
    if (action === 'return') return json_({ ok: true, data: readReturnSheet_(getReturnSheetFromStrategy_(e.parameter.strategy)) });
    if (action === 'version' || action === 'checkVersion') return json_({ ok: true, data: getVersionInfo_(), revision: officialRevision_() });
    return json_({ ok: false, error: 'Unsupported action' });
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'exchangeAdminSession') return json_(exchangeAdminSession_(body));
    if (body.action === 'publish_content') return json_(publishContentRequest_(body));
    return json_({ success: false, ok: false, error: 'Unsupported action' });
  } catch (error) { return json_({ success: false, ok: false, error: error.message }); }
}

function exchangeAdminSession_(body) {
  ['launchTicket','launchNonce','browserProof','appId'].forEach(key => { if (typeof body[key] !== 'string' || !body[key] || body[key].length > 200) fail_('Invalid Admin launch request'); });
  if (body.appId !== APP_ID) fail_('Invalid App ID');
  const result = platformRequest_({ action: 'exchangeAdminSession', launchTicket: body.launchTicket, launchNonce: body.launchNonce, browserProof: body.browserProof, appId: APP_ID });
  const expiry = Date.parse(result.expiresAt || '');
  if (result.success !== true || result.appId !== APP_ID || !result.adminSessionProof || result.contract !== 'ava-admin-session-v1' || !Number.isFinite(expiry) || expiry <= Date.now()) fail_('Admin launch denied');
  return { success: true, ok: true, appId: APP_ID, adminSessionProof: String(result.adminSessionProof), expiresAt: result.expiresAt, contract: result.contract };
}

function verifyAdminSession_(adminSessionProof, operation) {
  if (typeof adminSessionProof !== 'string' || !adminSessionProof) fail_('Admin session proof is required');
  if (typeof operation !== 'string' || !/^5pay:official-write:[a-z0-9_-]+$/.test(operation)) fail_('Invalid Official operation');
  const result = platformRequest_({ action: 'verifyAdminSession', adminSessionProof, appId: APP_ID, operation });
  const expiry = Date.parse(result.expiresAt || '');
  if (result.success !== true || result.appId !== APP_ID || result.operation !== operation || result.contract !== 'ava-admin-session-v1' || !Number.isFinite(expiry) || expiry <= Date.now()) fail_('Invalid or expired Admin authorization');
  return result;
}

function platformRequest_(body) {
  const endpoint = PropertiesService.getScriptProperties().getProperty(PLATFORM_ENDPOINT_PROPERTY);
  if (!endpoint) fail_('AVA Platform Admin endpoint is not configured');
  const response = UrlFetchApp.fetch(endpoint, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify(body), muteHttpExceptions: true });
  let result;
  try { result = JSON.parse(response.getContentText() || '{}'); } catch (_) { fail_('Invalid AVA Platform Admin response'); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || result.success !== true) fail_(result.error || 'AVA Platform Admin request failed');
  return result;
}

function publishContentRequest_(body) {
  if (!body || body.appId !== APP_ID) fail_('Invalid App ID');
  const validated = validatePublish_(body.data);
  const expectedVersion = String(body.expectedVersion || '');
  if (!expectedVersion) fail_('Expected version is required');
  validated.forEach(item => verifyAdminSession_(body.adminSessionProof, APP_ID + ':official-write:' + item.domain));
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  const snapshots = [];
  try {
    validatePublishTargets_(validated);
    if (expectedVersion !== getExpectedVersion_()) fail_('Stale Official data version');
    validated.forEach(item => snapshots.push(snapshotSheet_(SHEETS[item.domain])));
    const systemSnapshot = snapshotSheet_(SHEETS.system); snapshots.push(systemSnapshot);
    validated.forEach(item => writeObjectsToSheet_(item.domain, item.rows));
    updateLastUpdated_();
    validateReadAfterWrite_(validated);
    CacheService.getScriptCache().remove(BOOTSTRAP_CACHE_KEY);
    const revision = officialRevision_();
    return {
      success: true,
      ok: true,
      appId: APP_ID,
      operation: APP_ID + ':official-write:configuration',
      published: validated.map(item => item.domain),
      data: readOfficialSnapshot_(),
      revision,
      persisted: true,
      read_after_write: true,
      data_version: getDataVersion_(),
      last_updated: new Date().toISOString()
    };
  } catch (error) {
    snapshots.reverse().forEach(snapshot => { try { restoreSnapshot_(snapshot); } catch (_) {} });
    throw error;
  } finally { lock.releaseLock(); }
}

function validatePublish_(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail_('Publish data is required');
  const keys = Object.keys(body);
  keys.forEach(key => { if (!WRITE_DOMAINS.includes(key)) fail_(`Unknown publish domain: ${key}`); });
  if (!keys.length) fail_('At least one Official domain is required');
  return keys.map(domain => ({ domain, rows: validateRows_(domain, body[domain]) }));
}

function validateRows_(domain, rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) fail_(`Invalid ${domain} rows`);
  const fields = SCHEMAS[domain], seen = {};
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail_(`Invalid ${domain} row ${index + 1}`);
    Object.keys(row).forEach(key => { if (!fields.includes(key)) fail_(`Protected or unknown ${domain}.${key}`); });
    fields.forEach(key => { if (!Object.prototype.hasOwnProperty.call(row, key)) fail_(`Missing ${domain}.${key} at row ${index + 1}`); });
    const copy = {};
    fields.forEach(key => { if (Object.prototype.hasOwnProperty.call(row, key)) copy[key] = row[key]; });
    validateDomainRow_(domain, copy, index);
    const identity = copy[identityField_(domain)];
    if (identity) { if (seen[identity]) fail_(`Duplicate ${domain} identity`); seen[identity] = true; }
    return copy;
  });
}

function identityField_(domain) {
  return ({
    flow: 'page_id',
    page_content: 'content_id',
    routing: 'route_id',
    current_methods: 'method_key',
    withdrawal_strategies: 'strategy_code',
    customer_view: 'block_id'
  })[domain] || '';
}

function validatePublishTargets_(validated) {
  validated.forEach(item => {
    const sheet = sheet_(SHEETS[item.domain]), lastColumn = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String), allowed = SCHEMAS[item.domain];
    headers.forEach(header => { if (!allowed.includes(header)) fail_('Unexpected ' + item.domain + ' Sheet header: ' + header); });
    if (headers.length !== allowed.length || item.rows.length + 1 > sheet.getMaxRows()) fail_('Invalid ' + item.domain + ' Sheet capacity or schema');
  });
  const system = sheet_(SHEETS.system), values = system.getDataRange().getValues(), headers = values.shift().map(String), keyIndex = headers.indexOf('key'), valueIndex = headers.indexOf('value');
  if (keyIndex < 0 || valueIndex < 0 || !values.some(row => String(row[keyIndex]) === 'last_updated')) fail_('Saving_System last_updated schema is protected or invalid');
}

function validateDomainRow_(domain, row, index) {
  const text = (key, required, max) => { if (required && (typeof row[key] !== 'string' || !row[key].trim())) fail_(`Invalid ${domain}.${key} at row ${index + 1}`); if (row[key] !== undefined && (typeof row[key] !== 'string' || row[key].length > max)) fail_(`Invalid ${domain}.${key} at row ${index + 1}`); };
  const bool = key => { if (typeof row[key] !== 'boolean') fail_(`Invalid ${domain}.${key} at row ${index + 1}`); };
  const integer = (key, min) => { if (!Number.isInteger(row[key]) || row[key] < min) fail_(`Invalid ${domain}.${key} at row ${index + 1}`); };
  if (domain === 'flow') { text('page_id', true, 20); text('page_type', true, 40); text('title', true, 500); text('subtitle', true, 1000); integer('order', 1); bool('enabled'); bool('skippable'); }
  if (domain === 'page_content') { text('content_id', true, 40); text('page_id', true, 20); text('content_type', true, 60); text('headline', true, 500); text('subtext', true, 1000); text('action_key', true, 100); integer('order', 1); bool('enabled'); }
  if (domain === 'routing') { text('route_id', true, 40); text('method_key', true, 100); text('reason_key', true, 100); text('visualization_type', true, 100); text('next_page', true, 20); bool('enabled'); }
  if (domain === 'current_methods') { text('method_key', true, 100); text('display_name', true, 200); text('model_type', true, 100); text('assumption_source', true, 100); text('future_rule', true, 100); text('visual_title', true, 500); bool('enabled'); }
  if (domain === 'customer_view') { text('block_id', true, 40); text('block_type', true, 100); text('title', true, 500); text('subtitle', true, 1000); integer('order', 1); bool('enabled'); }
  if (domain === 'withdrawal_strategies') {
    text('strategy_code', true, 100); text('display_name', true, 200); text('sheet_name', true, 40); integer('sort_order', 1); bool('enabled');
    if (!Object.prototype.hasOwnProperty.call(STRATEGY_SHEETS, row.strategy_code) || STRATEGY_SHEETS[row.strategy_code] !== row.sheet_name || !RETURN_SHEETS.includes(row.sheet_name)) fail_(`Invalid protected strategy mapping at row ${index + 1}`);
    if (!(row.start_year === '' || Number.isInteger(row.start_year))) fail_(`Invalid withdrawal start_year at row ${index + 1}`);
    if (typeof row.withdraw_rate !== 'number' || !isFinite(row.withdraw_rate) || row.withdraw_rate < 0 || row.withdraw_rate > 1) fail_(`Invalid withdrawal rate at row ${index + 1}`);
  }
}

function writeObjectsToSheet_(domain, rows) {
  const sheet = sheet_(SHEETS[domain]), headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String), values = rows.map(row => headers.map(header => row[header] === undefined ? '' : row[header]));
  if (headers.length !== SCHEMAS[domain].length || values.length + 1 > sheet.getMaxRows()) fail_('Destination capacity is insufficient');
  if (values.length) sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  const oldRows = Math.max(0, sheet.getLastRow() - 1 - values.length);
  if (oldRows) sheet.getRange(values.length + 2, 1, oldRows, headers.length).clearContent();
}

function validateReadAfterWrite_(validated) {
  validated.forEach(item => {
    const actual = rows_(SHEETS[item.domain]).slice(0, item.rows.length);
    const expected = item.rows.map(row => Object.fromEntries(SCHEMAS[item.domain].map(key => [key, row[key]])));
    if (JSON.stringify(actual.map(row => Object.fromEntries(SCHEMAS[item.domain].map(key => [key, row[key]])))) !== JSON.stringify(expected)) fail_('Read-after-write verification failed for ' + item.domain);
  });
  return true;
}

function snapshotSheet_(name) {
  const sheet = sheet_(name), range = sheet.getDataRange();
  return { name, values: range.getValues(), formulas: range.getFormulas() };
}

function restoreSnapshot_(snapshot) {
  const sheet = sheet_(snapshot.name), rows = snapshot.values.length, cols = rows ? snapshot.values[0].length : 1;
  sheet.getDataRange().clearContent();
  if (!rows) return;
  const range = sheet.getRange(1, 1, rows, cols); range.setValues(snapshot.values);
  snapshot.formulas.forEach((row, r) => row.forEach((formula, c) => { if (formula) sheet.getRange(r + 1, c + 1).setFormula(formula); }));
}

function sheet_(name) { const sheet = SpreadsheetApp.getActive().getSheetByName(name); if (!sheet) fail_(`Missing Sheet: ${name}`); return sheet; }
function rows_(name) { const sheet = sheet_(name), values = sheet.getDataRange().getValues(); if (!values.length) return []; const headers = values.shift().map(String); return values.filter(row => row.some(value => value !== '')).map(row => Object.fromEntries(headers.map((key, index) => [key, row[index]]))); }
function readContent_() { return { flow: rows_(SHEETS.flow), page_content: rows_(SHEETS.page_content), routing: rows_(SHEETS.routing), current_methods: rows_(SHEETS.current_methods), withdrawal_strategies: rows_(SHEETS.withdrawal_strategies), customer_view: rows_(SHEETS.customer_view) }; }
function normalizeNumber_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') { const number = Number(value.replace(/,/g, '').trim()); return Number.isFinite(number) ? number : null; }
  return null;
}
function normalizePercent_(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim().endsWith('%')) { const number = normalizeNumber_(value.trim().slice(0, -1)); return number === null ? 0 : number / 100; }
  const number = normalizeNumber_(value); return number === null ? 0 : number;
}
function readReturnSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName); if (!sheet) fail_(`Missing return Sheet: ${sheetName}`);
  const values = sheet.getDataRange().getValues(); values.shift();
  return values.map(row => ({ policy_year: normalizeNumber_(row[0]), withdrawal_rate: normalizePercent_(row[1]), multiplier: normalizeNumber_(row[2]) })).filter(row => row.policy_year !== null);
}
function getReturnSheetFromStrategy_(strategy) { const strategyCode = String(strategy || ''), mapping = rows_(SHEETS.withdrawal_strategies).find(row => String(row.strategy_code) === strategyCode); if (!mapping || !RETURN_SHEETS.includes(String(mapping.sheet_name))) fail_('Unknown Saving withdrawal strategy'); return String(mapping.sheet_name); }
function readReturnTables_() { return Object.fromEntries(RETURN_SHEETS.map(name => [name, readReturnSheet_(name)])); }
function getSystemData_() { return Object.fromEntries(rows_(SHEETS.system).map(row => [String(row.key), row.value])); }
function versionValue_(value) { return value instanceof Date ? value.toISOString() : String(value || ''); }
function getDataVersion_() { const system = getSystemData_(); return versionValue_(system.data_version || system.module_version || system.schema_version || system.last_updated); }
function readOfficialSnapshot_() { const content = readContent_(); return { system: getSystemData_(), flow: content.flow, page_content: content.page_content, routing: content.routing, current_methods: content.current_methods, withdrawal_strategies: content.withdrawal_strategies, customer_view: content.customer_view, return_tables: readReturnTables_() }; }
function officialRevision_() { const canonical = JSON.stringify(readOfficialSnapshot_()); return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical).map(byte => (byte + 256).toString(16).slice(-2)).join(''); }
function getExpectedVersion_() { return officialRevision_(); }
function getVersionInfo_() { const system = getSystemData_(); return { module_name: system.module_name || 'Saving', module_version: versionValue_(system.module_version), schema_version: versionValue_(system.schema_version), data_version: versionValue_(system.data_version), last_updated: versionValue_(system.last_updated), revision: officialRevision_() }; }
function readBootstrap_() { const snapshot = readOfficialSnapshot_(); return { ...snapshot, revision: officialRevision_() }; }
function updateLastUpdated_() { const sheet = sheet_(SHEETS.system), values = sheet.getDataRange().getValues(), headers = values.shift().map(String), keyIndex = headers.indexOf('key'), valueIndex = headers.indexOf('value'); if (keyIndex < 0 || valueIndex < 0) fail_('Saving_System schema is protected or invalid'); const rowIndex = values.findIndex(row => String(row[keyIndex]) === 'last_updated'); if (rowIndex < 0) fail_('Saving_System last_updated row is required'); sheet.getRange(rowIndex + 2, valueIndex + 1).setValue(new Date()); }
