import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseHeadlines,makeEdition} from './headlines.mjs';
import {selectVerifiedLabels} from './visual-labels.mjs';

const headlines=Array.from({length:15},(_,i)=>({id:`id${i}`,title:`根拠となる記事見出し${i}`,media:'媒体',date:'2026-09-18'}));
const article=i=>({title:`検証用の記事見出し${i}`,summary:'提供された見出しに含まれる事実のみを短く伝える。',category:'社会',sourceIds:[`id${i}`]});
const edition=()=>({important:Array.from({length:13},(_,i)=>article(i)),sports:[article(13)],other:[article(14)]});

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
test('labels use verified concept spellings and drop unsupported names',()=>{
  assert.deepEqual(selectVerifiedLabels([{source:'高市内閣',english:'TAKAYCHI CABINET'},{source:'高市',english:'TAKAYCHI'},{source:'銀行',english:'BANCKS'}],'高市内閣と銀行'),['CABINET','BANKS']);
  assert.deepEqual(selectVerifiedLabels([{source:'銀行',english:'BANKS'}],'内閣'),[]);
});
test('generator accepts concise print bodies; overlong output preserves the existing edition',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'newspaper-test-'));
  try{
    const input=join(dir,'input.txt'),output=join(dir,'newspaper.json');
    await writeFile(input,headlines.map((h,i)=>`- 根拠となる記事見出し${i}（媒体）2026/9/18`).join('\n'));
    const sources=parseHeadlines(await readFile(input,'utf8'));
    const data=edition();
    [...data.important,...data.sports,...data.other].forEach((a,i)=>{a.sourceIds=[`E${i+1}`];a.printBody={oneLine:a.summary,twoLines:a.summary,shortfallReason:''}});
    const run=()=>spawnSync(process.execPath,['--input-type=module','-e',`
      globalThis.setTimeout=(callback)=>{callback();return 0};
      globalThis.fetch=async (_url,options)=>{
        const request=JSON.parse(options.body);
        if(request.generationConfig.responseSchema.properties.important.items.properties.sourceIds.items.enum.length!==15)throw Error('Missing evidence enum');
        return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(${JSON.stringify(data)})}]}}]})};
      };
      await import(${JSON.stringify(pathToFileURL(resolve('newspaper/generate-newspaper.mjs')).href)});
    `],{encoding:'utf8',env:{...process.env,GEMINI_API_KEY:'test-only',NEWSPAPER_INPUT:input,NEWSPAPER_OUTPUT:output}});
    const success=run();assert.equal(success.status,0,success.stderr);
    const saved=await readFile(output,'utf8');
    assert.equal(JSON.parse(saved).important.length,13);
    assert.equal(JSON.parse(saved).important[0].printBody.oneLine,data.important[0].summary);
    assert.equal(JSON.parse(saved).important[0].sources[0].id,sources[0].id);
    data.important[0].printBody.oneLine='長'.repeat(281);
    const failure=run();assert.notEqual(failure.status,0);assert.match(failure.stderr,/20–280/);
    assert.equal(await readFile(output,'utf8'),saved);
  }finally{await rm(dir,{recursive:true,force:true})}
});
