import {createHash} from 'node:crypto';
import fs from 'node:fs';
export const NORMAL_SECTIONS=['重要ニュース','経済ニュース','国内ニュース','海外ニュース','その他ニュース'];
export const sourceHash=text=>createHash('sha256').update(text).digest('hex');
export function normalEdition(text,{now=new Date()}={}){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const sections=Object.fromEntries(NORMAL_SECTIONS.map(s=>[s,[]]));let section;
  for(const line of text.split(/\r?\n/)){
    const heading=line.trim().match(/^●([^●]+)●$/);
    if(heading){section=NORMAL_SECTIONS.includes(heading[1])?heading[1]:null;continue;}
    if(!section)continue;
    const item=line.match(/^\s*\d+[.．]\s*(.+?)\s*[（(]([^（）()]+)[）)]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})\s*$/);
    if(!item){if(/^\s*\d+[.．]/.test(line))throw Error('Malformed confirmed normal headline');continue;}
    const date=[item[3],item[4].padStart(2,'0'),item[5].padStart(2,'0')].join('-');
    if(date>today)throw Error('Future date in confirmed normal news');
    const title=item[1].trim(),media=item[2];
    sections[section].push({id:sourceHash(`${date}|${media}|${title}`).slice(0,16),title,media,date});
  }
  if(NORMAL_SECTIONS.some(s=>!sections[s].length))throw Error('All five normal sections must be complete');
  const date=Object.values(sections).flat().map(a=>a.date).sort().at(-1);
  const cutoff=new Date(`${date}T00:00:00Z`).getTime()-86400000;
  for(const s of NORMAL_SECTIONS)sections[s]=sections[s].filter(a=>new Date(`${a.date}T00:00:00Z`).getTime()>=cutoff);
  return {schemaVersion:1,date,sourceHash:sourceHash(text),sections};
}
export function paperInputs(normal){
  const seen=new Set(),unique=items=>items.filter(a=>{const key=a.title.normalize('NFKC');if(seen.has(key))return false;seen.add(key);return true;});
  const important=unique(['重要ニュース','経済ニュース','海外ニュース','国内ニュース'].flatMap(s=>normal.sections[s])).slice(0,20);
  const others=unique(normal.sections['その他ニュース']).slice(0,12);
  return {important,others};
}
export function verifyPaper(normal,paper){
  if(paper.preview||paper.date!==normal.date||paper.sourceUpdatedAt!==normal.date||paper.normalSourceHash!==normal.sourceHash)throw Error('Paper edition does not match the confirmed normal edition');
  const inputs=paperInputs(normal);
  for(const s of ['important','others']){
    if(!Array.isArray(paper[s])||paper[s].length!==inputs[s].length)throw Error(`Incomplete paper section: ${s}`);
    paper[s].forEach((article,i)=>{
      if(article.sources?.length!==1||article.sources[0].id!==inputs[s][i].id||article.sources[0].title!==inputs[s][i].title||article.sources[0].date!==inputs[s][i].date)throw Error('Paper source does not match its assigned normal article');
    });
  }
  return paper;
}
export function cartoonMatches(normal,paper,cartoon){
  try{verifyPaper(normal,paper);}catch{return false;}
  return !!cartoon&&cartoon.date===normal.date&&cartoon.normalSourceHash===normal.sourceHash&&cartoon.paperSourceHash===sourceHash(JSON.stringify(paper))&&[...paper.important.slice(0,20),...paper.others.slice(0,9)].some(a=>a.id===cartoon.paperArticleId);
}
export function readConfirmedEdition(root){
  const text=fs.readFileSync(`${root}/summary2.txt`,'utf8'),normal=JSON.parse(fs.readFileSync(`${root}/news-edition.json`,'utf8'));
  if(normal.sourceHash!==sourceHash(text))throw Error('Normal edition snapshot is stale');
  return normal;
}
