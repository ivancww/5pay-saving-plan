import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import {
  isValidDeploymentMetadata,
  reloadOnceForBuild,
  requestSkipWaiting,
  shouldForceUpdate,
  updateStatusMarkup
} from '../src/update-gate.js';

test('older online build is mandatory while current build is allowed', () => {
  assert.equal(shouldForceUpdate({ online: true, runningBuildId: 'build-a', deployedBuildId: 'build-b' }), true);
  assert.equal(shouldForceUpdate({ online: true, runningBuildId: 'build-b', deployedBuildId: 'build-b' }), false);
  assert.equal(shouldForceUpdate({ online: false, runningBuildId: 'build-a', deployedBuildId: 'build-b' }), false);
});

test('deployment metadata must contain a real build identity', () => {
  assert.equal(isValidDeploymentMetadata({ version: 'V0.0.0', buildId: 'build-b' }), true);
  assert.equal(isValidDeploymentMetadata({ version: 'V0.0.0', buildId: '__AVA_DEPLOYMENT_ID__' }), false);
  assert.equal(isValidDeploymentMetadata({ version: 'V0.0.0' }), false);
});

test('waiting worker receives SKIP_WAITING', () => {
  const messages = [];
  const registration = { waiting: { postMessage: message => messages.push(message) } };
  assert.equal(requestSkipWaiting(registration), true);
  assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(requestSkipWaiting({ waiting: null }), false);
});

test('controller-change reload guard permits exactly one reload per deployed build', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
  let reloads = 0;
  const options = { storage, reload: () => { reloads += 1; } };
  assert.equal(reloadOnceForBuild('build-b', options), true);
  assert.equal(reloadOnceForBuild('build-b', options), false);
  assert.equal(reloads, 1);
  assert.equal(reloadOnceForBuild('build-c', options), true);
  assert.equal(reloads, 2);
});

test('update status is customer-facing and does not offer an old-build choice', () => {
  const markup = updateStatusMarkup();
  assert.match(markup, /正在更新至最新版本/);
  assert.doesNotMatch(markup, /稍後更新|繼續使用舊版|Skip update|Update later/);
});

test('deployment and shell contracts preserve customer data and retire only app-shell caches', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const workflow = fs.readFileSync(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
  assert.match(main, /fetchDeploymentMetadata/);
  assert.match(main, /visibilitychange/);
  assert.match(main, /reloadOnceForBuild/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /clients\.claim\(\)/);
  assert.match(sw, /caches\.delete/);
  assert.match(sw, /version\.json/);
  assert.match(sw, /scenario2-market-history\.js/);
  assert.match(workflow, /version\.json/);
  assert.doesNotMatch(sw, /indexedDB|localStorage/);
});
