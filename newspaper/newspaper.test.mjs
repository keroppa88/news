import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseHeadlines,makeEdition} from './headlines.mjs';

const headlines=Array.from({length:32},(_,i)=>({id:`id${i}`,title:`根拠となる記事見出し${i}`,media:'媒体',date:'2026-09-18'}));
const article=i=>({title:`検証用の記事見出し${i}`,summary:'提供された見出しに含まれる事実のみを短く伝える。',category:'社会',sourceIds:[`id${i}`]});
const edition=()=>({important:Array.from({length:20},(_,i)=>article(i)),others:Array.from({length:12},(_,i)=>article(20+i))});

test('section media and inline media are parsed',()=>{
  assert.equal(parseHeadlines('●●媒体●●\n- 根拠となる記事見出し (2026/9/18)\n- 別のニュース見出し（別媒体）2026/9/18').length,2);
});
test('headlines without bullets or with time-stamped dates are parsed',()=>{
  const text='### ●●BBC●●\nキエフ橋、ドローン攻撃で再び被害（UTC 2026/10/04 19:00）\n### ●●日経・読売・産経・47・みんかぶ●●\n台風27号、北寄りに進む（産経/社会）（2026/10/04 18:29）\n### ●●ロイター●●\n記事なし';
  const parsed=parseHeadlines(text);
  assert.deepEqual(parsed.map(h=>[h.media,h.title,h.date]),[['BBC','キエフ橋、ドローン攻撃で再び被害','2026-10-04'],['産経/社会','台風27号、北寄りに進む','2026-10-04']]);
});
test('deduplicate within an article without losing its evidence',()=>{
  const data=edition();data.important[0].sourceIds.push('id0');
  assert.equal(makeEdition(data,headlines).important[0].sources.length,1);
});
test('unknown, missing, and reused evidence retain actionable diagnostics',()=>{
  for(const [ids,pattern] of [[[],/important\[1\].*at least one/],[['invented'],/important\[1\].*invented/],[['id0'],/important\[1\].*id0.*reused/]]){
    const data=edition();data.important[1].sourceIds=ids;
    assert.throws(()=>makeEdition(data,headlines),pattern);
  }
});
test('an edition can contain fewer than 32 articles and empty optional sections',()=>{
  const sources=headlines.slice(0,5);
  const data={important:Array.from({length:5},(_,i)=>article(i)),others:[]};
  assert.equal(makeEdition(data,sources).important.length,5);
  assert.deepEqual(makeEdition(data,sources).others,[]);
  assert.throws(()=>makeEdition({important:[],others:[]},sources),/At least one story/);
});
test('generator accepts concise bodies, edits oversized text, and preserves data on editing failure',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'newspaper-test-'));
  try{
    const input=join(dir,'input.txt'),output=join(dir,'newspaper.json');
    await writeFile(input,headlines.map((h,i)=>`- 根拠となる記事見出し${i}（媒体）2026/9/18`).join('\n'));
    const sources=parseHeadlines(await readFile(input,'utf8'));
    const data=edition();
    [...data.important,...data.others].forEach((a,i)=>{a.sourceIds=[`E${i+1}`];a.printBody={oneLine:a.summary,twoLines:a.summary,shortfallReason:''}});
    const run=(failEdits=false,sourceCount=32)=>spawnSync(process.execPath,['--input-type=module','-e',`
      globalThis.setTimeout=(callback)=>{callback();return 0};
      globalThis.fetch=async (_url,options)=>{
        const request=JSON.parse(options.body);
        if(request.generationConfig.responseSchema.properties.text){
          if(${failEdits})return {ok:false,status:500};
          return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'フェルスタッペン、レースで圧倒'})}]}}]})};
        }
        if(request.generationConfig.responseSchema.properties.stories.items.properties.sourceIds.minItems!==1)throw Error('Missing evidence requirement');
        const data=${JSON.stringify(data)};
        if(${sourceCount}<32){data.important=data.important.slice(0,${sourceCount});data.others=[]}
        const {section,start,max}=JSON.parse(request.contents[0].parts[0].text).currentTask;
        return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({stories:data[section].slice(start,start+max)})}]}}]})};
      };
      await import(${JSON.stringify(pathToFileURL(resolve('newspaper/generate-newspaper.mjs')).href)});
    `],{encoding:'utf8',env:{...process.env,GEMINI_API_KEY:'test-only',NEWSPAPER_INPUT:input,NEWSPAPER_OUTPUT:output}});
    const success=run();assert.equal(success.status,0,success.stderr);
    let saved=await readFile(output,'utf8');
    assert.equal(JSON.parse(saved).important.length,20);
    assert.equal(JSON.parse(saved).others.length,12);
    assert.equal(JSON.parse(saved).important[0].printBody.oneLine,data.important[0].summary);
    assert.equal(JSON.parse(saved).important[0].sources[0].id,sources[0].id);
    data.others[0].title='マックス・フェルスタッペン、ゴーカートレースで100人を圧倒';
    const edited=run();assert.equal(edited.status,0,edited.stderr);
    saved=await readFile(output,'utf8');
    assert.equal(JSON.parse(saved).others[0].title,'フェルスタッペン、レースで圧倒');
    assert.equal(JSON.parse(saved).others[0].sources[0].id,sources[20].id);
    data.important[0].printBody.oneLine='長'.repeat(281);
    const compacted=run();assert.equal(compacted.status,0,compacted.stderr);
    saved=await readFile(output,'utf8');
    assert.ok(JSON.parse(saved).important[0].printBody.oneLine.length<=280);
    const failure=run(true);assert.notEqual(failure.status,0);assert.match(failure.stderr,/Text editing HTTP 500/);
    assert.equal(await readFile(output,'utf8'),saved);
    await writeFile(input,headlines.slice(0,5).map((h,i)=>`- 根拠となる記事見出し${i}（媒体）2026/9/18`).join('\n'));
    const shortEdition=run(false,5);assert.equal(shortEdition.status,0,shortEdition.stderr);
    const shortData=JSON.parse(await readFile(output,'utf8'));
    assert.equal(shortData.important.length,5);
    assert.deepEqual(shortData.others,[]);
  }finally{await rm(dir,{recursive:true,force:true})}
});
