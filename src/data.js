export const ENDPOINT = 'https://script.google.com/macros/s/AKfycbw_tBrwEiGfaZSNBgLwv1eNyjG8KEWj0QeHZZPANh5endIuPfwl8HMT6LujWWqSXZaKRg/exec';
import { normalizeMediaList } from './media.js';
const CACHE_KEY = 'ava-saving-official-cache-v1';
export const USER_DATA_SCHEMA = 'ava-saving-user-v1';

export const strategyMap = {
  none: '自動滾存',
  withdraw7_from8: '8年領取',
  withdraw12_from15: '15年領取',
  withdraw18_from20: '20年領取',
  withdraw23_from25: '25年領取',
  withdraw29_from30: '30年領取'
};

const json = response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); };

export function normalize(payload, version = {}) {
  const data = payload?.data || {};
  const tables = data.return_tables || {};
  const strategies = (data.withdrawal_strategies || []).filter(item => item.enabled !== false).sort((a, b) => a.sort_order - b.sort_order);
  const configuredStrategyMap = Object.fromEntries(strategies.filter(item => item.strategy_code && item.sheet_name).map(item => [item.strategy_code, item.sheet_name]));
  return {
    ...data,
    version: version.data || data.version || {},
    flow: (data.flow || []).filter(page => page.enabled !== false).sort((a, b) => a.order - b.order),
    page_content: (data.page_content || []).filter(item => item.enabled !== false).sort((a, b) => a.order - b.order),
    strategies,
    current_methods: (data.current_methods || []).filter(item => item.enabled !== false),
    return_tables: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, (Array.isArray(rows) ? rows : []).filter(row => Number.isFinite(Number(row?.policy_year)) && Number.isFinite(Number(row?.multiplier)))])),
    strategyMap: { ...strategyMap, ...configuredStrategyMap }
  };
}

export async function loadOfficialData() {
  const cached = readCache();
  try {
    const [bootstrapResult, versionResult, contentResult, returnsResult] = await Promise.allSettled([
      fetch(`${ENDPOINT}?action=bootstrap`).then(json),
      fetch(`${ENDPOINT}?action=version`).then(json),
      fetch(`${ENDPOINT}?action=content`).then(json),
      fetch(`${ENDPOINT}?action=returns`).then(json)
    ]);
    if (bootstrapResult.status !== 'fulfilled') throw bootstrapResult.reason;
    const bootstrap = bootstrapResult.value;
    const version = versionResult.status === 'fulfilled' ? versionResult.value : {};
    const content = contentResult.status === 'fulfilled' ? contentResult.value : {};
    const returns = returnsResult.status === 'fulfilled' ? returnsResult.value : {};
    const base = normalize(bootstrap, version);
    const contentData = content?.data || {};
    const returnData = returns?.data || {};
    const official = normalize({ data: {
      ...base,
      ...contentData,
      return_tables: { ...base.return_tables, ...returnData }
    }}, version);
    writeCache(official);
    return { official, source: 'cloud', stale: false };
  } catch (error) {
    if (cached) return { official: cached, source: 'local-cache', stale: true, error };
    throw error;
  }
}

function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; } }
function writeCache(value) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* storage is optional */ } }

export function loadOverrides() { try { return JSON.parse(localStorage.getItem('ava-saving-user-overrides-v1') || '{}'); } catch { return {}; } }
export function saveOverrides(value) { try { localStorage.setItem('ava-saving-user-overrides-v1', JSON.stringify(value)); } catch { /* storage is optional */ } }

/** Merge only presentation-layer overrides. Official content and return rows stay read-only. */
export function applyLocalOverrides(official, overrides = {}) {
  const pages = overrides.pages || {};
  const customPages = (Array.isArray(overrides.customPages) ? overrides.customPages : []).map((page, index) => ({
    ...page,
    page_type: ['content', 'image', 'video'].includes(page.page_type) ? page.page_type : 'content',
    media: normalizeMediaList(page.media, page.page_type),
    order: Number.isFinite(Number(page.order)) ? Number(page.order) : 3.5 + index / 100,
    enabled: page.enabled !== false,
    createdAt: page.createdAt || new Date().toISOString(),
    updatedAt: page.updatedAt || page.createdAt || new Date().toISOString()
  }));
  const flow = [...(official.flow || []), ...customPages].map((page, index) => {
    const local = pages[page.page_id] || {};
    return { ...page, ...local, order: Number.isFinite(Number(local.order)) ? Number(local.order) : (page.order ?? index + 1), enabled: local.hidden !== true && page.enabled !== false };
  }).filter(page => page.enabled !== false).sort((a, b) => a.order - b.order);
  const pageContent = (official.page_content || []).map(item => {
    const local = overrides.cards?.[item.content_id] || {};
    return { ...item, ...local, enabled: local.hidden !== true && item.enabled !== false };
  }).filter(item => item.enabled !== false);
  return { ...official, flow, page_content: pageContent };
}
