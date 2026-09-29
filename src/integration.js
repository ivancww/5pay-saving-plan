export const ENTRY_MODES = Object.freeze({
  standalone: 'standalone',
  frontend: 'frontend',
  user: 'user',
  admin: 'admin',
  unsupported: 'unsupported'
});

export function getEntryMode(search = '') {
  const value = new URLSearchParams(search).get('avaEntry');
  if (!value) return ENTRY_MODES.standalone;
  if (value === ENTRY_MODES.frontend || value === ENTRY_MODES.user) return value;
  if (value === ENTRY_MODES.admin) return ENTRY_MODES.admin;
  return ENTRY_MODES.unsupported;
}

export function avaReturnHref(mode, { parentHref = '', referrer = '' } = {}) {
  const surface = mode === ENTRY_MODES.user ? 'user' : 'frontend';
  for (const candidate of [parentHref, referrer]) {
    try {
      const url = new URL(candidate);
      if (!url.pathname.replace(/index\.html$/, '').endsWith('/avaplatform/')) continue;
      const avaRoot = new URL('./', url);
      avaRoot.searchParams.set('avaSurface', surface);
      return avaRoot.href;
    } catch {
      // A missing or malformed return context must not become a guessed URL.
    }
  }
  return null;
}
