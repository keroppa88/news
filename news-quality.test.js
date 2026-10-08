const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { normalize, validate, needsTranslation, limitArticles, MEDIA_LIMITS } = require('./news-quality');

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


test('media counts are capped while all editorial sections are retained', () => {
 const oversized=complete()+'\n'+Object.keys(MEDIA_LIMITS).map(name=>'●'+name+'●\n'+Array.from({length:186},(_,i)=>`${i+1}. 日本語の媒体記事${i}（日経）2099/10/07`).join('\n')).join('\n');
 assert.throws(()=>validate(oversized),/more than/);
 const sections=validate(limitArticles(oversized));
 for(const [name,max] of Object.entries(MEDIA_LIMITS)) assert.equal(sections[name].length,max);
 assert.equal(sections['重要ニュース'].length,10);
 assert.equal(limitArticles(limitArticles(oversized)),limitArticles(oversized));
});

test('normal-page rebuild is independent of illustration code and old saved images', t => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'normal-cartoon-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const folder of ['web']) fs.mkdirSync(path.join(root,folder));
 fs.copyFileSync(path.join(__dirname,'web/format.js'),path.join(root,'web/format.js'));
 fs.writeFileSync(path.join(root,'summary2.txt'),complete());
 fs.writeFileSync(path.join(root,'editorial-cartoon.png'),'fixture');
 fs.writeFileSync(path.join(root,'editorial-cartoon.json'),JSON.stringify({title:'試験題名',date:'2099-10-07',sourceHash:'hash',size:'816x816'}));
 for(let i=0;i<2;i++) {
  execFileSync(process.execPath,[path.join(root,'web/format.js')]);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.equal((html.match(/EDITORIAL_CARTOON_START/g)||[]).length,0);
  assert.ok(html.includes('class="news-item"'));
  assert.equal(fs.readFileSync(path.join(root,'editorial-cartoon.png'),'utf8'),'fixture');
 }
});

