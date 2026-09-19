'use strict';
const SOURCE='https://www.matsui.co.jp/market/';
const MAIN_TABLE='https://finance.matsui.co.jp/parts/major-index-list';
const FX_TABLE='https://finance.matsui.co.jp/fx/index';
const REQUIRED=['nikkei','nikkeiFutures','topix','dow','sp500','nasdaq','usdjpy'];
const clean=s=>String(s??'').replace(/−|－/g,'-').replace(/＋/g,'+').replace(/\u00a0/g,' ').trim();
const number=s=>{const m=clean(s).match(/^([+-]?[\d,]+(?:\.\d+)?)$/);return m?Number(m[1].replace(/,/g,'')):null;};
const delta=s=>{const m=clean(s).match(/([+-]\s*[\d,]+(?:\.\d+)?)/);return m?Number(m[1].replace(/[\s,]/g,'')):null;};
const rate=s=>{const m=clean(s).match(/([+-]?[\d,.]+)\s*[%％]/);return m?Number(m[1].replace(/,/g,'')):null;};
function dateOf(text,capturedAt){
  const s=clean(text),m=s.match(/(?:(20\d{2})\/)?(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/);
  if(!m)return null;
  const capture=new Date(capturedAt);
  let year=m[1]?Number(m[1]):Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Tokyo',year:'numeric'}).format(capture));
  const month=Number(m[2]),day=Number(m[3]);
  if(!m[1]&&new Date(Date.UTC(year,month-1,day)).getTime()>capture.getTime()+36*3600000)year--;
  return `${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}${m[4]?' '+m[4]:''}`;
}
function keyFor(name){
  const s=clean(name).replace(/\s/g,'');
  if(s==='日経平均株価')return 'nikkei';
  if(s==='日経225指数先物')return 'nikkeiFutures';
  if(/^TOPIX(?:\(東証株価指数\))?$/.test(s))return 'topix';
  if(s==='NYダウ')return 'dow';
  if(s==='S&P500')return 'sp500';
  if(/^NASDAQ(?:総合指数)?$/.test(s))return 'nasdaq';
  if(s==='米ドル'||s==='米ドル/円')return 'usdjpy';
  return null;
}
function parseRow(cells,capturedAt,fxDate){
  const [name,...rest]=cells.map(clean),key=keyFor(name);
  if(!key||!rest.length)return null;
  const date=rest.map(s=>dateOf(s,capturedAt)).find(Boolean)||(key==='usdjpy'?fxDate:null);
  if(!date)return null;
  if(key==='usdjpy'){
    const bid=rest.find(s=>/^売\s*/.test(s))||rest[1];
    const value=number((bid||'').replace(/^売\s*/,''));
    const change=rest.map(s=>delta(s)).find(n=>n!==null);
    return value===null||change===undefined?null:{key,value,change,date};
  }
  const value=number(rest[0]);
  if(value===null)return null;
  if(key==='nikkeiFutures')return {key,value,date};
  const percent=rest.slice(1).map(rate).find(n=>n!==null);
  if(percent===undefined)return null;
  if(['topix','sp500','nasdaq'].includes(key))return {key,percent,date};
  const change=rest.slice(1).map(delta).find(n=>n!==null);
  return change===undefined?null:{key,value,change,percent,date};
}
function extractRows(rows,capturedAt,fxDate){
  const markets={};
  for(const row of rows){const result=parseRow(row,capturedAt,fxDate);if(result&&!markets[result.key]){const {key,...quote}=result;markets[key]=quote;}}
  return markets;
}
function extractFallback(text,capturedAt,fxDate){
  const lines=text.split(/\r?\n/).map(clean).filter(Boolean),markets={};
  for(let i=0;i<lines.length;i++){
    const key=keyFor(lines[i]);if(!key||markets[key])continue;
    const next=lines.slice(i+1,i+6),stop=next.findIndex(keyFor);
    const result=parseRow([lines[i],...(stop<0?next:next.slice(0,stop))],capturedAt,fxDate);
    if(result){const {key:k,...quote}=result;markets[k]=quote;}
  }
  return markets;
}
function fxTimestamp(text,capturedAt){
  const m=text.match(/対円レート\s*(20\d{2}\/\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?)/);
  return m?dateOf(m[1],capturedAt):null;
}
const complete=markets=>REQUIRED.every(key=>markets?.[key]);
const num=(n,d=2,max=d)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:max});
const signed=(n,d=2)=>`${n>=0?'+':''}${num(n,d)}`;
const pct=n=>`${signed(n)}%`;
function displayed(item,key){
  if(!item)return `${key} —`;
  const date=`（${item.date}）`;
  if(key==='日経平均株価'||key==='NYダウ')return `${key} ${num(item.value)} ${signed(item.change)} ${pct(item.percent)} ${date}`;
  if(key==='日経225指数先物')return `${key} ${num(item.value)} ${date}`;
  if(key==='米ドル円')return `${key} ${num(item.value,2,4)} ${signed(item.change)} ${date}`;
  return `${key} ${pct(item.percent)} ${date}`;
}
module.exports={SOURCE,MAIN_TABLE,FX_TABLE,REQUIRED,extractRows,extractFallback,fxTimestamp,complete,displayed,dateOf,parseRow};
