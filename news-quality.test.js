const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalize, validate, needsTranslation } = require('./news-quality');

function complete() {
  return Object.entries({ '重要ニュース': 10, '経済ニュース': 10, '国内ニュース': 5, '海外ニュース': 5, 'その他ニュース': 5 }).map(([name, count]) => `●${name}●\n` + Array.from({ length: count }, (_, i) => `${i + 1}. 日本語の報道記事${i}（BBC）2099/10/07`).join('\n')).join('\n\n');
}

test('Markdown headers and numbering preserve all five editorial sections', () => {
  const markdown = complete().replace(/^●(.+)●$/gm, '### **●●$1●●**').replace(/^(\d+)\. /gm, '$1.');
  assert.equal(Object.keys(validate(normalize(markdown))).length, 5);
});

test('media-only output and incomplete editorial output cannot be published', () => {
  assert.throws(() => validate('●BBC●\n1. 日本語記事（BBC）2099/10/07'), /重要ニュース/);
  assert.throws(() => validate(complete().replace('10. 日本語の報道記事9（BBC）2099/10/07', '')), /重要ニュース/);
});

test('English detection excludes media/date and allows Japanese acronym headlines', () => {
  assert.equal(needsTranslation('1. Trump announces new policy（BBC）2099/10/07'), true);
  assert.equal(needsTranslation('1. AIとFRB、米国市場への影響（BBC）2099/10/07'), false);
  assert.throws(() => validate(complete() + '\n●BBC●\n1. Trump announces new policy（BBC）2099/10/07'), /English/);
});

async function supplement(response) {
  const files = new Map([['summary2.txt', complete()], ['summary1.txt', '### BBC\n* Trump announces new policy（BBC）2099/10/07']]);
  const writes = [];
  const fakeFs = { readFileSync: p => files.get(p), existsSync: () => true, mkdirSync() {}, writeFileSync(p, value) { files.set(p, value); writes.push(p); } };
  let calls = 0;
  const fakeSdk = { GoogleGenerativeAI: class { getGenerativeModel() { return { generateContent: async () => { calls++; return { response: { text: () => response } }; } }; } } };
  const module = { exports: {} };
  const context = { module, exports: module.exports, __dirname: '.', process: { env: {} }, console: { log() {}, error() {} }, setTimeout, require: name => name === 'fs' ? fakeFs : name === '@google/generative-ai' ? fakeSdk : name === './news-quality' ? require('./news-quality') : require(name) };
  vm.runInNewContext(fs.readFileSync(require.resolve('./summarize4'), 'utf8'), context);
  return { files, writes, get calls() { return calls; }, run: module.exports.run };
}

test('English supplemented from summary1 is translated before writing, metadata retained', async () => {
  const mock = await supplement('[{"id":0,"headline":"トランプ氏が新政策を発表"}]');
  await mock.run();
  assert.equal(mock.calls, 1);
  assert.match(mock.files.get('summary2.txt'), /1\. トランプ氏が新政策を発表（BBC）2099\/10\/07/);
  validate(mock.files.get('summary2.txt'));
});

test('invalid translation retries then leaves the previous published input untouched', async () => {
  const mock = await supplement('[]');
  await assert.rejects(mock.run(), /count mismatch/);
  assert.equal(mock.calls, 2);
  assert.deepEqual(mock.writes, []);
});
