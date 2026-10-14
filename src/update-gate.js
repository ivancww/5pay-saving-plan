const PLACEHOLDER_BUILD_ID = '__AVA_DEPLOYMENT_ID__';

export function isValidDeploymentMetadata(metadata) {
  return Boolean(
    metadata &&
    typeof metadata.version === 'string' &&
    metadata.version &&
    typeof metadata.buildId === 'string' &&
    metadata.buildId &&
    metadata.buildId !== PLACEHOLDER_BUILD_ID
  );
}

export function shouldForceUpdate({ online = true, runningBuildId, deployedBuildId } = {}) {
  return Boolean(
    online &&
    isValidDeploymentMetadata({ version: 'unknown', buildId: deployedBuildId }) &&
    typeof runningBuildId === 'string' &&
    runningBuildId !== deployedBuildId
  );
}

export async function fetchDeploymentMetadata(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`./version.json?updateCheck=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' }
  });
  if (!response?.ok) throw new Error(`Deployment metadata unavailable: ${response?.status || 'unknown'}`);
  const metadata = await response.json();
  if (!isValidDeploymentMetadata(metadata)) throw new Error('Deployment metadata is incomplete.');
  return metadata;
}

export function requestSkipWaiting(registration) {
  const worker = registration?.waiting;
  if (!worker) return false;
  worker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export function reloadOnceForBuild(buildId, {
  storage = globalThis.sessionStorage,
  reload = () => globalThis.location.reload()
} = {}) {
  const key = `ava-saving-mandatory-update:${buildId}`;
  try {
    if (storage?.getItem(key)) return false;
    storage?.setItem(key, '1');
  } catch {
    // A restricted storage context must not block the update attempt.
  }
  reload();
  return true;
}

export function updateStatusMarkup() {
  return '<div class="ava-status ava-status--update" role="status" aria-live="assertive"><strong>正在更新至最新版本…</strong></div>';
}
