import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseHeadlines,makeEdition} from './headlines.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const input=resolve(process.env.NEWSPAPER_INPUT||'summary1.txt');
const output=resolve(process.env.NEWSPAPER_OUTPUT||'newspaper.json');
const model=process.env.NEWSPAPER_MODEL||'gemini-2.5-flash-lite';
const apiKey=process.env.GEMINI_API_KEY;
if(!apiKey)throw Error('GEMINI_API_KEY is required; the existing newspaper file is preserved.');
if(!/^[a-zA-Z0-9.-]+$/.test(model))throw Error('Invalid model ID');
const headlines=parseHeadlines(await readFile(input,'utf8'));
const date=headlines.map(h=>h.date).sort().at(-1);
const cutoff=new Date(`${date}T00:00:00Z`).getTime()-86400000;
const current=headlines.filter(h=>new Date(`${h.date}T00:00:00Z`).getTime()>=cutoff);
if(current.length<12)throw Error('Insufficient source headlines; the previous edition is preserved.');
const prompt=await readFile(resolve(here,'newspaper-prompt.txt'),'utf8');
const maxAttempts=2;
let lastError;
let correction="";
for(let attempt=1;attempt<=maxAttempts;attempt++){
  try{
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},signal:AbortSignal.timeout(90000),
      body:JSON.stringify({systemInstruction:{parts:[{text:prompt}]},contents:[{role:'user',parts:[{text:JSON.stringify({date,headlines:current,correction})}]}],generationConfig:{temperature:0.2,maxOutputTokens:16384,responseMimeType:'application/json'}})
    });
    if(!response.ok){const error=new Error(`Gemini HTTP ${response.status}`);error.retryable=response.status===429||response.status>=500;throw error}
    const result=await response.json();
    const candidate=result.candidates?.[0];
    if(candidate?.finishReason!=='STOP')throw Error(`Incomplete output: ${candidate?.finishReason||'no candidate'}`);
    const text=(candidate.content?.parts||[]).filter(p=>!p.thought&&p.text).map(p=>p.text).join('');
    const parsed=JSON.parse(text);if(parsed.error)throw Error(`Editorial generation declined: ${parsed.reason}`);
    const edition=makeEdition(parsed,current,{date,editorLabel:model});
    for(const section of ['important','sports','other']){
      for(let i=0;i<edition[section].length;i++){
        if(section==='important'&&i>=8)continue;
        const article=parsed[section][i], target=edition[section][i];
        const top=section==='important'&&i===0;
        const two=section==='important'&&[1,2,6,7].includes(i);
        const ranges=top?[[360,390],[140,155]]:two?[[300,315],[210,225]]:[[190,200],[135,145]];
        const maxTitle=top?48:two?44:28;
        const invalid=message=>{const e=new Error(section+'['+i+']: '+message);e.retryable=true;throw e};
        if([...target.title].length>maxTitle)invalid('title exceeds '+maxTitle+' characters');
        const body=article.printBody;
        if(!body||typeof body!=='object')invalid('printBody is required');
        for(const [key,index] of [['oneLine',0],['twoLines',1]]){
          const text=body[key], [min,max]=ranges[index];
          if(typeof text!=='string'||[...text].length<20||[...text].length>max)invalid(key+' must contain 20–'+max+' characters');
          if([...text].length<min&&!(typeof body.shortfallReason==='string'&&body.shortfallReason.trim()))invalid(key+' must contain '+min+'–'+max+' characters; explain insufficient evidence only if necessary');
        }
        target.printBody={oneLine:body.oneLine,twoLines:body.twoLines,shortfallReason:body.shortfallReason||''};
      }
    }
    await mkdir(dirname(output),{recursive:true});const temp=`${output}.tmp`;await writeFile(temp,JSON.stringify(edition,null,2)+'\n');await rename(temp,output);
    const usage=result.usageMetadata||{};
    console.log(JSON.stringify({model,date,articles:edition.important.length+edition.sports.length+edition.other.length,inputTokens:usage.promptTokenCount,outputTokens:usage.candidatesTokenCount,thinkingTokens:usage.thoughtsTokenCount||0,totalTokens:usage.totalTokenCount}));
    lastError=null;break;
  }catch(e){lastError=e;correction="前回の出力は検証不合格。修正して全記事を返す: "+e.message;console.error(`Newspaper attempt ${attempt}: ${e.message}`);if(!e.retryable||attempt===maxAttempts)break;await new Promise(r=>setTimeout(r,3000))}
}
if(lastError)throw new Error('Newspaper generation failed; the previous edition is preserved. '+lastError.message);
