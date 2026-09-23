export const ENDPOINT = 'https://script.google.com/macros/s/AKfycbw_tBrwEiGfaZSNBgLwv1eNyjG8KEWj0QeHZZPANh5endIuPfwl8HMT6LujWWqSXZaKRg/exec';
const CACHE_KEY = 'ava-saving-official-cache-v1';

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
  return {
    ...data,
    version: version.data || data.version || {},
    flow: (data.flow || []).filter(page => page.enabled !== false).sort((a, b) => a.order - b.order),
    page_content: (data.page_content || []).filter(item => item.enabled !== false).sort((a, b) => a.order - b.order),
    strategies: (data.withdrawal_strategies || []).filter(item => item.enabled !== false).sort((a, b) => a.sort_order - b.sort_order),
    current_methods: (data.current_methods || []).filter(item => item.enabled !== false),
    return_tables: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.filter(row => Number.isFinite(Number(row.policy_year)) && Number.isFinite(Number(row.multiplier)))])),
    strategyMap
  };
}

export async function loadOfficialData() {
  const cached = readCache();
  try {
    const [bootstrap, version] = await Promise.all([
      fetch(`${ENDPOINT}?action=bootstrap`).then(json),
      fetch(`${ENDPOINT}?action=version`).then(json)
    ]);
    const official = normalize(bootstrap, version);
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
