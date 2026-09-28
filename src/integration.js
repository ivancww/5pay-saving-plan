export const ENTRY_MODES = Object.freeze({
  standalone: 'standalone',
  frontend: 'frontend',
  user: 'user',
  unsupported: 'unsupported'
});

export const AVA_PLATFORM_URL = 'https://ivancww.github.io/avaplatform/index.html';

export function getEntryMode(search = '') {
  const value = new URLSearchParams(search).get('avaEntry');
  if (!value) return ENTRY_MODES.standalone;
  if (value === ENTRY_MODES.frontend || value === ENTRY_MODES.user) return value;
  return ENTRY_MODES.unsupported;
}

export function avaReturnHref(mode) {
  const surface = mode === ENTRY_MODES.user ? 'user' : mode === ENTRY_MODES.unsupported ? 'frontend' : 'frontend';
  return `${AVA_PLATFORM_URL}?avaSurface=${surface}`;
}
