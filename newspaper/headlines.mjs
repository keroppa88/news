import { createHash } from 'node:crypto';
export function parseHeadlines(text){
  // summary1.txt の書き方はGeminiの実行ごとに揺れる（行頭の「* 」「- 」の有無、日付の後置・括弧内、媒体名の有無など）ので、
  // 「日付を含む行」を見出しとして広く拾い、媒体名が無ければ所属セクション名を使う。
  const found=new Map();
  let sectionMedia='';
  for(const raw of text.split(/\r?\n/)){
    const heading=raw.match(/●●([^●]+)●●/);
    if(heading){sectionMedia=heading[1].trim();continue}
    if(/^\s*#/.test(raw))continue;
    const dateMatch=raw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if(!dateMatch)continue;
    const line=raw.replace(/^\s*(?:[-*・]|\d+[.．])\s*/,'').trim();
    const groups=[...line.matchAll(/[（(]([^（）()]*)[）)]/g)].map(m=>m[1].trim());
    const media=groups.find(g=>g&&!/\d{4}\/\d{1,2}\/\d{1,2}/.test(g)&&!/^UTC/.test(g)&&g.length<=30)||sectionMedia;
    let title=line;
    // 末尾の（媒体）（日付）や裸の日付を取り除く
    for(let i=0;i<3;i++)title=title.replace(/\s*(?:[（(][^（）()]*[）)]|\d{4}\/\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?)\s*$/,'');
    title=title.trim().replace(/\s+/g,' ');
    if(!media||title.length<4||/提供されていない|記事なし/.test(title))continue;
    const date=[dateMatch[1],dateMatch[2].padStart(2,'0'),dateMatch[3].padStart(2,'0')].join('-');
    const id=createHash('sha256').update(`${date}|${media}|${title}`).digest('hex').slice(0,16);
    if(!found.has(id))found.set(id,{id,title,media,date});
  }
  return [...found.values()];
}
export function validateOutput(data,headlines){
  if(!data||typeof data!=='object')throw Error('JSON object required');
  const known=new Map(headlines.map(h=>[h.id,h])),seen=new Set(),refs=new Set();
  for(const [section,min,max] of [['important',0,20],['others',0,12]]){
    if(!Array.isArray(data[section])||data[section].length<min||data[section].length>max)throw Error(`${section}: expected ${min}–${max} stories, received ${data[section]?.length??'missing'}`);
    for(const [index,a] of data[section].entries()){
      if(typeof a.title!=='string'||a.title.length<5||a.title.length>80||typeof a.summary!=='string'||a.summary.length<20||a.summary.length>400||typeof a.category!=='string'||a.category.length>20)throw Error('Invalid story text');
      if(seen.has(a.title))throw Error(`${section}[${index}]: duplicate story ${a.title}; choose a different event`);seen.add(a.title);
      const location=`${section}[${index}] (${a.title})`;
      if(!Array.isArray(a.sourceIds)||!a.sourceIds.length)throw Error(`${location}: sourceIds must contain at least one input id`);
      const unknown=a.sourceIds.filter(id=>!known.has(id));
      if(unknown.length)throw Error(`${location}: unknown evidence IDs ${JSON.stringify(unknown)}; copy exact ids from the supplied headlines`);
      if(new Set(a.sourceIds).size!==a.sourceIds.length)throw Error('Duplicate evidence');
      for(const id of a.sourceIds){if(refs.has(id))throw Error(`${location}: evidence ID ${id} was reused across topics; merge duplicate topics or select a different supported story`);refs.add(id)}
    }
  }
  if(!['important','others'].some(section=>data[section].length))throw Error('At least one story is required');
  return data;
}
export function makeEdition(output,headlines,meta={}){
  const normalized={...output};
  for(const section of ['important','others']){
    if(!Array.isArray(output?.[section]))continue;
    normalized[section]=output[section].map(article=>{
      if(!Array.isArray(article?.sourceIds))return article;
      // Only remove duplicates within an article. Never silently discard evidence.
      const sourceIds=[...new Set(article.sourceIds)];
      return {...article,sourceIds};
    });
  }
  validateOutput(normalized,headlines);
  const known=new Map(headlines.map(h=>[h.id,h]));
  const dates=[...new Set(headlines.map(h=>h.date))].sort();
  const date=meta.date||dates.at(-1);
  return {schemaVersion:1,date,sourceUpdatedAt:meta.sourceUpdatedAt||date,generatedAt:new Date().toISOString(),editorLabel:meta.editorLabel||'Gemini',preview:!!meta.preview,...Object.fromEntries(['important','others'].map(section=>[section,normalized[section].map(a=>({id:createHash('sha256').update(`${date}|${a.title}`).digest('hex').slice(0,16),title:a.title,summary:a.summary,category:a.category,sources:a.sourceIds.map(id=>known.get(id))}))]))};
}
