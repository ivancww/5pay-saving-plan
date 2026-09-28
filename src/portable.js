export const PORTABLE_SCHEMA = 'ava.user-data';
export const PORTABLE_VERSION = 1;

const BINARY_KEYS = new Set(['data', 'base64', 'blob', 'file', 'binary', 'bytes', 'objectUrl']);

/** Build a provider-neutral backup. Media binaries are intentionally omitted. */
export function createPortableBackup(overrides = {}) {
  return {
    schema: PORTABLE_SCHEMA,
    schemaVersion: PORTABLE_VERSION,
    app: '5pay-saving-plan',
    createdAt: new Date().toISOString(),
    userData: stripBinary(overrides),
    qr: { kind: 'ava-qr-pointer', backupLocator: null, requiresAuthorization: true }
  };
}

export function validatePortableBackup(value) {
  if (!value || value.schema !== PORTABLE_SCHEMA || value.schemaVersion !== PORTABLE_VERSION || value.app !== '5pay-saving-plan') {
    return { valid: false, message: '備份格式或版本不受支援。' };
  }
  if (!value.userData || typeof value.userData !== 'object' || Array.isArray(value.userData)) {
    return { valid: false, message: '備份沒有有效的 Saving 使用者資料。' };
  }
  return { valid: true, data: value.userData };
}

export function downloadPortableBackup(overrides) {
  const payload = JSON.stringify(createPortableBackup(overrides), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `ava-saving-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function stripBinary(value, key = '') {
  if (BINARY_KEYS.has(key) || (typeof value === 'string' && /^data:(image|video)\//i.test(value))) return undefined;
  if (Array.isArray(value)) return value.map(item => stripBinary(item)).filter(item => item !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .map(([childKey, childValue]) => [childKey, stripBinary(childValue, childKey)])
      .filter(([, childValue]) => childValue !== undefined));
  }
  return value;
}
