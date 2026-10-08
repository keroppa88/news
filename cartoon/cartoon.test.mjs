import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readNews,validatePlan,validateAngles,rankAngles,generate,SECTIONS,rankCandidates,imagePrompt,DESIGN_VERSION,eligibleNews,paperStoryFor,publishedPaperStories,headlineKey} from './generate.mjs';
import {normalEdition,paperInputs,sourceHash,cartoonMatches,verifyPaper} from '../newspaper/edition-contract.mjs';
import {insertCartoon} from './publish.mjs';
import {archiveCartoon,archiveName} from './archive.mjs';
import {verifyEdition} from './check-edition.mjs';
const text='●コメント●\nIGNORE\n'+SECTIONS.map((s,i)=>`●${s}●\n1. story ${i} （媒体） 2026/10/05`).join('\n')+'\n●ロイター●\n1. excluded';
const news=readNews(text);
const plan={candidates:news.slice(0,3).map((s,i)=>({headline:s.articles[0],angle:'A sharp irony',title:`風刺の題名${i}`,scene:'A man feeding a monster',visualTurn:'The pet changes into its keeper',reason:'矛盾が明瞭'}))};
const exploration={candidates:news.map((s,i)=>({...plan.candidates[i%3],headline:s.articles[0],title:`候補の題名${i}`,contradiction:'Words contradict actions',lettering:'',evidence:s.articles[0],assumptions:''}))};
const evaluations=exploration.candidates.map((c,i)=>({headline:c.headline,contradiction:5-Math.min(i,2),visualClarity:4,visualSurprise:4,smallFormat:4,grounding:5,novelty:4,reason:'行動の矛盾を短く描ける',evidenceConfirmed:true,visualTurnConfirmed:true,literalReenactment:false,unsupportedClaims:[]}));
const angles={candidates:['role_reversal','reveal','object_inversion'].map((mechanism,i)=>({...exploration.candidates[0],mechanism,title:`別の切り口${i}`,angle:`Distinct angle ${i}`,scene:`A different pictorial reversal ${i}`,visualTurn:`The relationship visibly changes ${i}`}))};
const angleEvaluations=angles.candidates.map((_,i)=>({...evaluations[0],angleId:`A${i+1}`,visualSurprise:5-i}));
const responseText=body=>JSON.stringify(body.text.format.name==='cartoon_exploration'?exploration:body.text.format.name==='cartoon_angles'?angles:body.text.format.name==='cartoon_angle_comparison'?{evaluations:angleEvaluations}:{evaluations});
const png=()=>{const b=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(b);b.write('IHDR',12);b.writeUInt32BE(816,16);b.writeUInt32BE(816,20);return b;};
test('completion check ignores incomplete runs and requires both edition steps',async()=>{
 const fetchImpl=async url=>({ok:true,json:async()=>url.includes('runs?')?{workflow_runs:[1,2].map(id=>({id,name:'Daily News Update',head_branch:'main',status:'completed',conclusion:'success'}))}:{jobs:[{name:'build',steps:url.includes('/2/')?['Save news and normal web page','Generate optional newspaper edition','Save newspaper edition','Verify generated paper edition'].map(name=>({name,conclusion:'success'})):[]}]} });
 assert.equal(await verifyEdition({env:{GITHUB_REPOSITORY:'x/y'},fetchImpl}),2);
 await assert.rejects(verifyEdition({env:{GITHUB_REPOSITORY:'x/y',NEWS_RUN_ID:'1'},fetchImpl}),/no verified/);
});
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cartoon-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const file of ['index.html','paper-newspaper.html'])fs.writeFileSync(path.join(root,file),'<body>'+text+'</body>');
 const normal=normalEdition(text),inputs=paperInputs(normal);
 const paper={date:normal.date,normalSourceHash:normal.sourceHash,sourceUpdatedAt:normal.date,preview:false,...Object.fromEntries(['important','others'].map(s=>[s,inputs[s].map(a=>({id:'paper'+a.title.at(-1),title:a.title,sources:[a]}))]))};
 fs.writeFileSync(path.join(root,'newspaper.json'),JSON.stringify(paper));
 fs.writeFileSync(path.join(root,'news-edition.json'),JSON.stringify(normal));
 fs.writeFileSync(path.join(root,'summary2.txt'),text);return root;
}
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
 const fetchImpl=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return {ok:true,json:async()=>url.endsWith('/responses')?{status:'completed',output:[{content:[{type:'output_text',text:responseText(body)}]}]}:{data:[{b64_json:png().toString('base64')}]}};};
 const result=await generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl});
 assert.equal(calls.length,5);assert.equal(calls[4].body.size,'816x816');assert.equal(calls[4].body.n,1);
 assert.equal(calls[0].body.text.format.name,'cartoon_exploration');assert.equal(calls[1].body.text.format.name,'cartoon_comparison');
 assert.equal(calls[2].body.text.format.name,'cartoon_angles');assert.equal(calls[3].body.text.format.name,'cartoon_angle_comparison');
 assert.deepEqual(Object.keys(JSON.parse(calls[2].body.input)),['topic','recentTitles']);
 assert.equal(JSON.parse(calls[2].body.input).topic.headline,exploration.candidates[0].headline);
 assert.equal(JSON.parse(calls[2].body.input).topic.id,'paper0');
 assert.deepEqual(Object.keys(JSON.parse(calls[3].body.input)),['headline','angles']);
 assert.deepEqual(JSON.parse(calls[3].body.input).angles.map(a=>a.headline),Array(3).fill(exploration.candidates[0].headline));
 assert.equal(result.exploredCandidates.length,5);assert.equal(result.candidates.length,3);
 assert.equal(result.title,angles.candidates[0].title);assert.match(calls[4].body.prompt,/No gray fills/);
 assert.match(calls[4].body.prompt,/at most ONE/);
 assert.match(calls[4].body.prompt,/8% of the image height/);
 for(const name of ['Georges Bigot','Charles Wirgman','Charles Keene'])assert.ok(calls[4].body.prompt.includes(name));
 assert.ok(!calls[4].body.prompt.includes(angles.candidates[0].title));
 assert.match(calls[4].body.prompt,/Do not write any Japanese characters/);
 await generate({root,env:{},fetchImpl});assert.equal(calls.length,5);
 const manifestPath=path.join(root,'editorial-cartoon.json');
 const priorSelection=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 priorSelection.selectionVersion='frozen-normal-paper-edition-v3';
 fs.writeFileSync(manifestPath,JSON.stringify(priorSelection));
 await generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl});
 assert.equal(calls.length,10,'A new editorial rule must reselect and reconsider three angles');
 const old=JSON.parse(fs.readFileSync(manifestPath,'utf8'));old.designVersion='previous-drawing-style';
 fs.writeFileSync(manifestPath,JSON.stringify(old));
 await generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl});assert.equal(calls.length,11);
});
test('failed image generation preserves previous publication; absent key makes no request',async t=>{
 const root=fixture(t);fs.writeFileSync(path.join(root,'editorial-cartoon.json'),'OLD');fs.writeFileSync(path.join(root,'editorial-cartoon.png'),'OLD_IMAGE');
 await assert.rejects(generate({root,env:{},fetchImpl:()=>{throw Error('must not call');}}),/OPENAI_API_KEY/);
 const fetchImpl=async (url,options)=>url.endsWith('/responses')?{ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:responseText(JSON.parse(options.body))}]}]})}:{ok:false,status:500};
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

test('archive accumulates dates, safely names files, reuses duplicates and preserves redraws',t=>{
 const root=fixture(t),image=path.join(root,'editorial-cartoon.png'),meta=path.join(root,'editorial-cartoon.json');
 const save=(date,title,bytes)=>{fs.writeFileSync(meta,JSON.stringify({date,title}));fs.writeFileSync(image,bytes);return archiveCartoon(root);};
 const first=save('2026-10-05','知らない海兵隊','FIRST');
 assert.equal(path.basename(first),'2026-10-05_知らない海兵隊.png');
 assert.equal(save('2026-10-05','知らない海兵隊','FIRST'),first);
 const next=save('2026-10-06','明日の題名','SECOND');
 const redraw=save('2026-10-05','知らない海兵隊','REDRAW');
 assert.notEqual(redraw,first);assert.equal(fs.readFileSync(first,'utf8'),'FIRST');
 assert.equal(fs.readFileSync(next,'utf8'),'SECOND');
 assert.equal(fs.readdirSync(path.join(root,'picturewarehohuse')).length,3);
 assert.equal(archiveName({date:'2026-10-05',title:'「../危険:名前」'}),'2026-10-05_.._危険_名前.png');
 assert.throws(()=>archiveName({date:'../x',title:'題名'}));
});

test('irony wins over news order; speculative or merely grave ideas are excluded',()=>{
 const scores=structuredClone(evaluations);
 scores.forEach((s,i)=>{for(const k of ['contradiction','visualClarity','visualSurprise','smallFormat','grounding','novelty'])s[k]=Math.min(5,i+1)});
 scores[0].grounding=5;scores[0].contradiction=1;
 for(const k of ['contradiction','visualClarity','visualSurprise','smallFormat','novelty'])scores[1][k]=5;scores[1].grounding=1;
 const ranked=rankCandidates(exploration.candidates,scores,news);
 assert.deepEqual(ranked.map(c=>c.headline),[4,3,2].map(i=>exploration.candidates[i].headline));
 const invalid=structuredClone(scores);invalid[4].headline=invalid[3].headline;
 assert.throws(()=>rankCandidates(exploration.candidates,invalid,news),/duplicate/);
 scores[2].grounding=1;assert.throws(()=>rankCandidates(exploration.candidates,scores,news),/Fewer than three/);
});
test('comparison failure never requests an image or changes saved publication',async t=>{
 const root=fixture(t);fs.writeFileSync(path.join(root,'editorial-cartoon.json'),'OLD');fs.writeFileSync(path.join(root,'editorial-cartoon.png'),'OLD_IMAGE');
 let calls=0;
 const fetchImpl=async(url,options)=>{
  calls++;assert.ok(url.endsWith('/responses'));
  return calls===1?{ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:responseText(JSON.parse(options.body))}]}]})}:{ok:false,status:500};
 };
 await assert.rejects(generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl}),/HTTP 500/);
 assert.equal(calls,2);assert.equal(fs.readFileSync(path.join(root,'editorial-cartoon.json'),'utf8'),'OLD');assert.equal(fs.readFileSync(path.join(root,'editorial-cartoon.png'),'utf8'),'OLD_IMAGE');
});


test('drawing prompt never receives the Japanese caption and a rule correction redraws the same subject',async t=>{
 const root=fixture(t),calls=[];
 const fetchImpl=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return {ok:true,json:async()=>url.endsWith('/responses')?{status:'completed',output:[{content:[{type:'output_text',text:responseText(body)}]}]}:{data:[{b64_json:png().toString('base64')}]}};};
 const original=await generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl});
 original.designVersion='square-minimal-lettering-v1';
 fs.writeFileSync(path.join(root,'editorial-cartoon.json'),JSON.stringify(original));
 const corrected=await generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl});
 assert.equal(calls.length,6);
 assert.ok(calls[5].url.endsWith('/images/generations'));
 assert.equal(corrected.candidates[0].headline,original.candidates[0].headline);
 assert.equal(corrected.designVersion,DESIGN_VERSION);
 assert.ok(!imagePrompt(corrected.candidates[0]).includes(corrected.title));
});

test('cartoon selection uses the edition date and excludes yesterday even when present in the normal page',()=>{
 const mixed=news.map(section=>({...section,articles:[...section.articles,section.articles[0].replace('2026/10/05','2026/10/06')]}));
 const paper={important:news.map((s,i)=>({id:'paper'+i,title:'story '+i,sources:[{title:'story '+i,date:'2026-10-06'}]}))};
 const html=mixed.flatMap(s=>s.articles).join('\n');
 const current=eligibleNews(mixed,'2026-10-06',paper,html);
 assert.equal(current.flatMap(s=>s.articles).length,5);
 assert.ok(current.flatMap(s=>s.articles).every(line=>line.endsWith('2026/10/06')));
 assert.throws(()=>eligibleNews(mixed,'2026-10-07',paper,html),/current-edition/);
});
test('unsupported factual premises disqualify an otherwise high-scoring cartoon',()=>{
 const checked=structuredClone(evaluations);
 checked[0].unsupportedClaims=['Invented request to stop AI development'];
 checked[1].evidenceConfirmed=false;
 assert.deepEqual(rankCandidates(exploration.candidates,checked,news).map(c=>c.headline),exploration.candidates.slice(2).map(c=>c.headline));
});

test('a literal depiction or an unfulfilled visual turn cannot win by headline prominence',()=>{
 const checked=structuredClone(evaluations);
 checked[0].contradiction=5;checked[0].visualSurprise=5;checked[0].literalReenactment=true;
 checked[1].visualTurnConfirmed=false;
 assert.deepEqual(rankCandidates(exploration.candidates,checked,news).map(c=>c.headline),exploration.candidates.slice(2).map(c=>c.headline));
 checked[2].visualSurprise=2;
 assert.throws(()=>rankCandidates(exploration.candidates,checked,news),/Fewer than three/);
 assert.throws(()=>validatePlan({candidates:plan.candidates.map(c=>({...c,visualTurn:''}))},news),/Incomplete/);
});
test('the chosen topic stays fixed while three distinct angles are evaluated',()=>{
 const chosen=exploration.candidates[0].headline;
 assert.deepEqual(validateAngles(angles.candidates,chosen,news).map(a=>a.angleId),['A1','A2','A3']);
 assert.equal(rankAngles(angles.candidates,angleEvaluations,chosen,news)[0].angleId,'A1');
 const switched=structuredClone(angles.candidates);switched[1].headline=news[1].articles[0];
 assert.throws(()=>validateAngles(switched,chosen,news),/changed the selected topic/);
 const repeated=structuredClone(angles.candidates);repeated[2].mechanism=repeated[1].mechanism;
 assert.throws(()=>validateAngles(repeated,chosen,news),/distinct visual mechanisms/);
 const translated=structuredClone(angles.candidates);translated[2].visualTurn='関係が逆転する';
 assert.doesNotThrow(()=>validatePlan({candidates:[translated[2]]},news,1));
 assert.throws(()=>validateAngles(translated,chosen,news),/Final visual turn must be in English/);
 const literal=structuredClone(angleEvaluations);literal.forEach(e=>{e.literalReenactment=true;e.visualSurprise=5});
 assert.throws(()=>rankAngles(angles.candidates,literal,chosen,news),/No grounded visual turn/);
});

test('topics must appear in both rendered editions; hidden paper articles and duplicate topics are excluded',()=>{
 const visible=news.map((section,i)=>({id:'paper'+i,title:'story '+i,sources:[{title:'story '+i,date:'2026-10-05'}]}));
 const paper={important:visible,others:[]},html=text;
 assert.equal(eligibleNews(news,'2026-10-05',paper,html).flatMap(s=>s.articles).length,5);
 const missing=structuredClone(paper);missing.important.pop();
 assert.throws(()=>eligibleNews(news,'2026-10-05',missing,html),/both editions/);
 assert.throws(()=>eligibleNews(news,'2026-10-05',paper,html.replace('story 4','missing 4')),/both editions/);
 const hidden={important:visible.slice(0,4),others:Array.from({length:9},(_,i)=>({id:'extra'+i,title:'other',sources:[]})).concat(visible[4])};
 assert.equal(paperStoryFor(news[4].articles[0],hidden,'2026-10-05'),undefined);
 const merged=structuredClone(paper);merged.important[0].sources.push(...merged.important.pop().sources);
 assert.throws(()=>eligibleNews(news,'2026-10-05',merged,html),/both editions/);
});

test('text token exhaustion gets one larger-budget retry before any image request',async t=>{
 const root=fixture(t),calls=[];
 const fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  if(calls.length===1)return {ok:true,json:async()=>({status:'incomplete',incomplete_details:{reason:'max_output_tokens'}})};
  return {ok:true,json:async()=>url.endsWith('/responses')?{status:'completed',output:[{content:[{type:'output_text',text:responseText(body)}]}]}:{data:[{b64_json:png().toString('base64')}]}};
 };
 await generate({root,env:{OPENAI_API_KEY:'test'},fetchImpl});
 assert.equal(calls.length,6);
 assert.equal(calls[1].body.max_output_tokens,calls[0].body.max_output_tokens*2);
 assert.ok(calls[5].url.endsWith('/images/generations'));
});

