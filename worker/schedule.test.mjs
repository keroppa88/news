import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// package.jsonの"type"に依らずES moduleとして読む。
const source = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
const { runSchedule, EVENT_TYPE } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const env = { SCHEDULE_ENABLED: 'true', GH_TOKEN: 'test', GH_REPO: 'keroppa88/news' };
const c = { scheduledTime: Date.parse('2026-09-28T22:30:00Z') };

test('run.yml が同じイベント名とGitHub cron停止の条件を持つ', () => {
  const yml = readFileSync(new URL('../.github/workflows/run.yml', import.meta.url), 'utf8');
  assert.ok(yml.includes(`types: [${EVENT_TYPE}]`));
  assert.ok(yml.includes("vars.CLOUDFLARE_SCHEDULE != 'true'"));
});

test('無効化中は送らず、有効時は1回だけ送る', async () => {
  const calls = [];
  const send = async (url, init) => { calls.push({ url, ...JSON.parse(init.body) }); return { status: 204 }; };
  await runSchedule(c, { ...env, SCHEDULE_ENABLED: 'false' }, send);
  assert.equal(calls.length, 0);
  await runSchedule(c, env, send);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/keroppa88/news/dispatches');
  assert.equal(calls[0].event_type, 'scheduled-news');
  assert.equal(calls[0].client_payload.scheduled_at, '2026-09-28T22:30:00.000Z');
});

test('GitHubが受け取らなければ失敗として報告する', async () => {
  await assert.rejects(runSchedule(c, env, async () => ({ status: 403 })), /GitHub HTTP 403/);
});
