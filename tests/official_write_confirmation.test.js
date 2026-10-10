import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_DOMAINS, publishOfficial } from '../src/admin.js';

const REVISION = 'a'.repeat(64);
const DATA = Object.fromEntries(ADMIN_DOMAINS.map((domain) => [domain, [{ id: domain, value: 'confirmed' }]]));

function confirmedPayload(overrides = {}) {
  return {
    success: true,
    ok: true,
    appId: '5pay',
    operation: '5pay:official-write:configuration',
    published: [...ADMIN_DOMAINS],
    data: structuredClone(DATA),
    revision: REVISION,
    persisted: true,
    read_after_write: true,
    ...overrides
  };
}

function fetchPayload(payload) {
  return async () => ({ ok: true, json: async () => payload });
}

test('complete persisted snapshot is accepted', async () => {
  const result = await publishOfficial('proof', DATA, REVISION, fetchPayload(confirmedPayload()));
  assert.equal(result.persisted, true);
  assert.equal(result.read_after_write, true);
  assert.equal(result.revision, REVISION);
});

test('success:true without data is rejected', async () => {
  await assert.rejects(publishOfficial('proof', DATA, REVISION, fetchPayload(confirmedPayload({ data: undefined }))), /確認證據不完整/);
});

test('missing canonical revision is rejected', async () => {
  await assert.rejects(publishOfficial('proof', DATA, REVISION, fetchPayload(confirmedPayload({ revision: '' }))), /確認證據不完整/);
});

test('wrong dataset or stable record snapshot is rejected', async () => {
  const data = structuredClone(DATA);
  data.flow = [{ id: 'different-record', value: 'confirmed' }];
  await assert.rejects(publishOfficial('proof', DATA, REVISION, fetchPayload(confirmedPayload({ data }))), /flow/);
});

test('changed field mismatch is rejected', async () => {
  const data = structuredClone(DATA);
  data.page_content[0].value = 'unconfirmed';
  await assert.rejects(publishOfficial('proof', DATA, REVISION, fetchPayload(confirmedPayload({ data }))), /page_content/);
});

test('missing read-after-write evidence is rejected', async () => {
  await assert.rejects(publishOfficial('proof', DATA, REVISION, fetchPayload(confirmedPayload({ read_after_write: false }))), /確認證據不完整/);
});
