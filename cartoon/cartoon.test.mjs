import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readNews,validatePlan,generate,SECTIONS} from './generate.mjs';
import {insertCartoon} from './publish.mjs';
import {verifyEdition} from './check-edition.mjs';
const text='●コメント●\nIGNORE\n'+SECTIONS.map((s,i)=>`●${s}●\n1. story ${i} （媒体） 2026/10/05`).join('\n')+'\n●ロイター●\n1. excluded';
const news=readNews(text);
const plan={candidates:news.slice(0,3).map((s,i)=>({headline:s.articles[0],angle:'A sharp irony',title:`風刺の題名${i}`,scene:'A man feeding a monster',reason:'矛盾が明瞭'}))};
const png=()=>{const b=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(b);b.write('IHDR',12);b.writeUInt32BE(1024,16);b.writeUInt32BE(1024,20);return b;};
test('completion check ignores incomplete runs and requires both edition steps',async()=>{
 const fetchImpl=async url=>({ok:true,json:async()=>url.includes('runs?')?{workflow_runs:[1,2].map(id=>({id,name:'Daily News Update',head_branch:'main',status:'completed',conclusion:'success'}))}:{jobs:[{name:'build',steps:url.includes('/2/')?['Save news and normal web page','Generate optional newspaper edition','Save newspaper edition'].map(name=>({name,conclusion:'success'})):[]}]} });
 assert.equal(await verifyEdition({env:{GITHUB_REPOSITORY:'x/y'},fetchImpl}),2);
 await assert.rejects(verifyEdition({env:{GITHUB_REPOSITORY:'x/y',NEWS_RUN_ID:'1'},fetchImpl}),/no verified/);
});
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'cartoon-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));for(const file of ['index.html','paper-newspaper.html'])fs.writeFileSync(path.join(root,file),'{}');fs.writeFileSync(path.join(root,'newspaper.json'),JSON.stringify({sourceUpdatedAt:'2026-10-05',preview:false}));fs.writeFileSync(path.join(root,'summary2.txt'),text);return root;}
test('only the five normal sections are used; incomplete input fails',()=>{
 assert.deepEqual(news.map(s=>s.section),SECTIONS);assert.doesNotMatch(JSON.stringify(news),/IGNORE|excluded/);
 assert.throws(()=>readNews(text.replace('●その他ニュース●','●other●')),/complete/);
});
test('selection rejects invented headlines, duplicate stories and non-Japanese title',()=>{
 assert.deepEqual(validatePlan(plan,news),plan);
 for(const patch of [{headline:'invented'},{title:'English title'},{headline:plan.candidates[1].headline}]){
  const p=structuredClone(plan);Object.assign(p.candidates[0],patch);assert.throws(()=>validatePlan(p,news));
 }
});
test('API sequence, Japanese title, native square and duplicate-run cache',async t=>{
 const root=fixture(t),calls=[];
 const fetchImpl=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return {ok:true,json:async()=>url.endsWith('/responses')?{status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(plan)}]}]}:{data:[{b64_json:png().toString('base64')}]}};};
 const result=await generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl});
 assert.equal(calls.length,2);assert.equal(calls[1].body.size,'1024x1024');assert.equal(calls[1].body.n,1);
 assert.equal(result.title,plan.candidates[0].title);assert.match(calls[1].body.prompt,/No gray fills/);
 assert.match(calls[1].body.prompt,/at most ONE/);
 assert.match(calls[1].body.prompt,/8% of the image height/);
 for(const name of ['Georges Bigot','Charles Wirgman','Charles Keene'])assert.ok(calls[1].body.prompt.includes(name));
 assert.ok(calls[1].body.prompt.includes(`Japanese title「${plan.candidates[0].title}」`));
 await generate({root,env:{},fetchImpl});assert.equal(calls.length,2);
 const manifestPath=path.join(root,'editorial-cartoon.json');
 const old=JSON.parse(fs.readFileSync(manifestPath,'utf8'));old.size='1536x1152';delete old.designVersion;
 fs.writeFileSync(manifestPath,JSON.stringify(old));
 await generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl});assert.equal(calls.length,4);
});
test('failed image generation preserves previous publication; absent key makes no request',async t=>{
 const root=fixture(t);fs.writeFileSync(path.join(root,'editorial-cartoon.json'),'OLD');fs.writeFileSync(path.join(root,'editorial-cartoon.png'),'OLD_IMAGE');
 await assert.rejects(generate({root,env:{},fetchImpl:()=>{throw Error('must not call');}}),/OPENAI_API_KEY/);
 const fetchImpl=async url=>url.endsWith('/responses')?{ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(plan)}]}]})}:{ok:false,status:500};
 await assert.rejects(generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl}),/HTTP 500/);
 assert.equal(fs.readFileSync(path.join(root,'editorial-cartoon.json'),'utf8'),'OLD');assert.equal(fs.readFileSync(path.join(root,'editorial-cartoon.png'),'utf8'),'OLD_IMAGE');
});
test('unfinished paper edition blocks all API calls',async t=>{
 const root=fixture(t);fs.writeFileSync(path.join(root,'newspaper.json'),JSON.stringify({sourceUpdatedAt:'2026-10-04'}));
 await assert.rejects(generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl:()=>{throw Error('must not call');}}),/does not match/);
});
test('publisher inserts at page bottom at half width, escapes titles, and never duplicates',()=>{
 const html='<body><div class="container"><div class="update-time">time</div><div style="margin-bottom: 10px;"><img src="wordcloud.jpg?t=1" alt="Word Cloud"></div><div>News untouched</div></div></body>';
 const manifest={size:'1024x1024',title:'知らぬ顔 <script> & 逮捕',date:'2026-10-05',sourceHash:'123'};
 const once=insertCartoon(html,manifest);assert.ok(once.indexOf('<figure')>once.indexOf('<div>News untouched</div>'));assert.match(once,/style="width:50%;margin:12px 0 0"/);
 assert.match(once,/lang="ja"/);assert.match(once,/「知らぬ顔 &lt;script&gt; &amp; 逮捕」<\/figcaption>/);assert.match(once,/width="1024" height="1024"/);assert.match(once,/知らぬ顔 &lt;script&gt; &amp; 逮捕/);assert.match(once,/<div>News untouched<\/div>/);
 assert.equal(insertCartoon(once,manifest),once);assert.equal(insertCartoon(once,null),html);
});
