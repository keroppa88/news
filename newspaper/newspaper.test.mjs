import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseHeadlines,makeEdition} from './headlines.mjs';

const headlines=Array.from({length:18},(_,i)=>({id:`id${i}`,title:`根拠となる記事見出し${i}`,media:'媒体',date:'2026-09-18'}));
const article=i=>({title:`検証用の記事見出し${i}`,summary:'提供された見出しに含まれる事実のみを短く伝える。',category:'社会',sourceIds:[`id${i}`]});
const edition=()=>({important:Array.from({length:16},(_,i)=>article(i)),sports:[article(16)],other:[article(17)]});

test('section media and inline media are parsed',()=>{
  assert.equal(parseHeadlines('●●媒体●●\n- 根拠となる記事見出し (2026/9/18)\n- 別のニュース見出し（別媒体）2026/9/18').length,2);
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
test('an edition can contain fewer than 18 articles and empty optional sections',()=>{
  const sources=headlines.slice(0,5);
  const data={important:Array.from({length:5},(_,i)=>article(i)),sports:[],other:[]};
  assert.equal(makeEdition(data,sources).important.length,5);
  assert.deepEqual(makeEdition(data,sources).sports,[]);
  assert.throws(()=>makeEdition({important:[],sports:[],other:[]},sources),/At least one story/);
});
test('generator accepts concise bodies, edits oversized text, and preserves data on editing failure',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'newspaper-test-'));
  try{
    const input=join(dir,'input.txt'),output=join(dir,'newspaper.json');
    await writeFile(input,headlines.map((h,i)=>`- 根拠となる記事見出し${i}（媒体）2026/9/18`).join('\n'));
    const sources=parseHeadlines(await readFile(input,'utf8'));
    const data=edition();
    [...data.important,...data.sports,...data.other].forEach((a,i)=>{a.sourceIds=[`E${i+1}`];a.printBody={oneLine:a.summary,twoLines:a.summary,shortfallReason:''}});
    const run=(failEdits=false,sourceCount=18)=>spawnSync(process.execPath,['--input-type=module','-e',`
      globalThis.setTimeout=(callback)=>{callback();return 0};
      globalThis.fetch=async (_url,options)=>{
        const request=JSON.parse(options.body);
        if(request.generationConfig.responseSchema.properties.text){
          if(${failEdits})return {ok:false,status:500};
          return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'フェルスタッペン、レースで圧倒'})}]}}]})};
        }
        if(request.generationConfig.responseSchema.properties.stories.items.properties.sourceIds.minItems!==1)throw Error('Missing evidence requirement');
        const data=${JSON.stringify(data)};
        if(${sourceCount}<18){data.important=data.important.slice(0,${sourceCount});data.sports=[];data.other=[]}
        const {section,start,max}=JSON.parse(request.contents[0].parts[0].text).currentTask;
        return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({stories:data[section].slice(start,start+max)})}]}}]})};
      };
      await import(${JSON.stringify(pathToFileURL(resolve('newspaper/generate-newspaper.mjs')).href)});
    `],{encoding:'utf8',env:{...process.env,GEMINI_API_KEY:'test-only',NEWSPAPER_INPUT:input,NEWSPAPER_OUTPUT:output}});
    const success=run();assert.equal(success.status,0,success.stderr);
    let saved=await readFile(output,'utf8');
    assert.equal(JSON.parse(saved).important.length,16);
    assert.equal(JSON.parse(saved).important[0].printBody.oneLine,data.important[0].summary);
    assert.equal(JSON.parse(saved).important[0].sources[0].id,sources[0].id);
    data.sports[0].title='マックス・フェルスタッペン、ゴーカートレースで100人を圧倒';
    const edited=run();assert.equal(edited.status,0,edited.stderr);
    saved=await readFile(output,'utf8');
    assert.equal(JSON.parse(saved).sports[0].title,'フェルスタッペン、レースで圧倒');
    assert.equal(JSON.parse(saved).sports[0].sources[0].id,sources[16].id);
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
    assert.deepEqual(shortData.sports,[]);
    assert.deepEqual(shortData.other,[]);
  }finally{await rm(dir,{recursive:true,force:true})}
});
