import { createHash } from 'node:crypto';
export function parseHeadlines(text){
  const found=new Map();
  for(const line of text.split(/\r?\n/)){
    const m=line.match(/^\s*[-*]\s+(.+?)\s*[（(]([^（）()]+)[）)]\s*(\d{4}\/\d{1,2}\/\d{1,2})\s*$/);
    if(!m)continue;
    const title=m[1].trim().replace(/\s+/g,' '),media=m[2].trim(),date=m[3].split('/').map((x,i)=>i?x.padStart(2,'0'):x).join('-');
    if(title.length<4||/提供されていない|記事なし/.test(title))continue;
    const id=createHash('sha256').update(`${date}|${media}|${title}`).digest('hex').slice(0,16);
    if(!found.has(id))found.set(id,{id,title,media,date});
  }
  return [...found.values()];
}
export function validateOutput(data,headlines){
  if(!data||typeof data!=='object')throw Error('JSON object required');
  const known=new Map(headlines.map(h=>[h.id,h])),seen=new Set(),refs=new Set();
  for(const [section,min,max] of [['important',10,10],['sports',1,3],['other',1,3]]){
    if(!Array.isArray(data[section])||data[section].length<min||data[section].length>max)throw Error(`${section}: expected ${min}–${max} stories`);
    for(const a of data[section]){
      if(typeof a.title!=='string'||a.title.length<5||a.title.length>80||typeof a.summary!=='string'||a.summary.length<20||a.summary.length>400||typeof a.category!=='string'||a.category.length>20)throw Error('Invalid story text');
      if(seen.has(a.title))throw Error('Duplicate story');seen.add(a.title);
      if(!Array.isArray(a.sourceIds)||!a.sourceIds.length||a.sourceIds.some(id=>!known.has(id)))throw Error('Unknown or missing evidence ID');
      if(new Set(a.sourceIds).size!==a.sourceIds.length)throw Error('Duplicate evidence');
      for(const id of a.sourceIds){if(refs.has(id))throw Error('A headline was reused across topics');refs.add(id)}
    }
  }
  return data;
}
export function makeEdition(output,headlines,meta={}){
  const knownEvidence=new Set(headlines.map(h=>h.id));
  const usedEvidence=new Set();
  const normalized={...output};
  for(const section of ['important','sports','other']){
    if(!Array.isArray(output?.[section]))continue;
    normalized[section]=output[section].map(article=>{
      if(!Array.isArray(article?.sourceIds))return article;
      const sourceIds=article.sourceIds.filter(id=>{if(!knownEvidence.has(id)||usedEvidence.has(id))return false;usedEvidence.add(id);return true});
      return {...article,sourceIds};
    });
  }
  validateOutput(normalized,headlines);
  const known=new Map(headlines.map(h=>[h.id,h]));
  const dates=[...new Set(headlines.map(h=>h.date))].sort();
  const date=meta.date||dates.at(-1);
  return {schemaVersion:1,date,sourceUpdatedAt:meta.sourceUpdatedAt||date,generatedAt:new Date().toISOString(),editorLabel:meta.editorLabel||'Gemini',preview:!!meta.preview,...Object.fromEntries(['important','sports','other'].map(section=>[section,normalized[section].map(a=>({id:createHash('sha256').update(`${date}|${a.title}`).digest('hex').slice(0,16),title:a.title,summary:a.summary,category:a.category,sources:a.sourceIds.map(id=>known.get(id))}))]))};
}
