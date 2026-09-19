'use strict';
const BASE='https://www.rakuten-sec.co.jp/web/market/data/';
const URLS={index:BASE+'index_top.html',future:BASE+'future_top.html',commodities:BASE+'commodities_top.html',bond:BASE+'bond_top.html',exchange:BASE+'exchange_top.html'};
const REQUIRED=['nikkei','nikkeiFutures','topix','dow','sp500','nasdaq','usdjpy','oil','jgb10','ust10'];
const clean=s=>String(s??'').normalize('NFKC').replace(/[−–—ー]/g,'-').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
function numeric(s){const t=clean(s).replace(/,/g,'').replace(/^[¥$]/,'').trim();const m=t.match(/^([+\-]?\d+(?:\.\d+)?)(?:\s*[%％])?$/);return m?Number(m[1]):null;}
function signedNumber(s){const t=clean(s).replace(/,/g,'');const m=t.match(/^([+\-▲△▼▽↑↓])?\s*(\d+(?:\.\d+)?)/);if(!m||/\d/.test(t.slice(m[0].length).replace(/[%％\s()]/g,'')))return null;const n=Number(m[2]);return (m[1]==='-'||m[1]==='▲'||m[1]==='▼'||m[1]==='↓')?-n:n;}
function quoteDate(s,capturedAt){
 const t=clean(s).replace(/\([^)]*\)/g,' ').replace(/(20\d{2})-(\d{1,2})-(\d{1,2})/g,'$1/$2/$3');
 const m=t.match(/(?:(20\d{2})[年\/])?\s*(\d{1,2})[月\/]\s*(\d{1,2})日?(?:\s+([0-2]?\d:[0-5]\d))?/);
 if(!m)return null;const captured=new Date(capturedAt);if(Number.isNaN(captured.valueOf()))return null;
 const jst=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric'}).format(captured);
 let year=m[1]?Number(m[1]):Number(jst);const month=Number(m[2]),day=Number(m[3]);const d=new Date(Date.UTC(year,month-1,day));
 if(month<1||month>12||day<1||day>31||d.getUTCMonth()!==month-1)return null;
 if(!m[1]&&d.getTime()>captured.getTime()+36*3600000)year--;
 return `${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}${m[4]?' '+m[4]:''}`;
}
function keyFor(s){
 const t=clean(s).replace(/\s/g,'').toLowerCase();
 if(/(?:日経平均(?:株価)?|日経225)(?:\(.*\))?$/.test(t)&&!/(?:先物|future)/.test(t))return 'nikkei';
 if(/(?:日経225|日経平均|nikkei225).*(?:先物|future)/.test(t)&&!/(?:mini|ミニ|マイクロ)/.test(t))return 'nikkeiFutures';
 if(/^topix(?:\(.*\))?$/.test(t)&&!t.includes('先物'))return 'topix';
 if(/^(?:nyダウ|ダウ(?:工業株)?(?:30種)?(?:平均)?|ダウ・ジョーンズ(?:工業株)?(?:平均)?)(?:\(.*\))?$/.test(t))return 'dow';
 if(/^s&p500(?:(?:種(?:株価)?)?指数)?(?:\(.*\))?$/.test(t))return 'sp500';
 if(/^(?:nasdaq|ナスダック)(?:総合(?:指数)?)?(?:\(.*\))?$/.test(t))return 'nasdaq';
 if(/^(?:米ドル(?:\/|・|-)?円|usd(?:\/|-)jpy|ドル\/円)(?:\(.*\))?$/.test(t))return 'usdjpy';
 if(/^(?:wti(?:原油)?(?:先物)?|原油(?:\(wti\))?|原油wti(?:先物)?|wti原油(?:先物)?)(?:\(.*\))?$/.test(t))return 'oil';
 if(/^(?:日本(?:国債|10年国債|10年債|国債利回り)|日本国債利回り|日本10年(?:国債|債))/.test(t)&&/(?:10年)/.test(t))return 'jgb10';
 if(/^(?:米国|アメリカ)(?:10年)?(?:国債|10年債|国債利回り)/.test(t)&&/(?:10年)/.test(t))return 'ust10';
 return null;
}
function parseRow(cells,capturedAt){
 const c=cells.map(clean).filter(Boolean);if(c.length<4)return null;const key=keyFor(c[0]);if(!key)return null;
 const date=c.slice(3).map(s=>quoteDate(s,capturedAt)).find(Boolean);if(!date)return null;
 // Rakuten FX table: name | buy | sell | change (buy) | change % (buy) | updated.
 if(key==='usdjpy'){
  if(c.length<6)return null;
  const value=numeric(c[1]),change=signedNumber(c[3]);
  return value===null||change===null?null:{key,value,change,date};
 }
 const value=numeric(c[1]),change=signedNumber(c[2]);
 const percent=c.slice(3,-1).map(s=>s.includes('%')?signedNumber(s):null).find(n=>n!==null&&n!==undefined);
 // A missing daily change remains null; the published yield is still valid.
 if(['jgb10','ust10'].includes(key))return value===null?null:{key,value,change,date};
 if(['topix','sp500','nasdaq'].includes(key))return percent===undefined||percent===null?null:{key,percent,date};
 if(key==='nikkeiFutures')return value===null?null:{key,value,date};
 if(key==='oil')return value===null||change===null?null:{key,value,change,date};
 return value===null||change===null||percent===undefined||percent===null?null:{key,value,change,percent,date};
}
function extractRows(rows,capturedAt){const out={};for(const cells of rows){const r=parseRow(cells,capturedAt);if(r){const {key,...quote}=r;if(!out[key])out[key]=quote;}}return out;}
function extractFallback(text,capturedAt){
 const lines=String(text).split(/\r?\n/).map(clean).filter(Boolean);const out={};
 for(let i=0;i<lines.length;i++){
  if(!keyFor(lines[i]))continue;const next=lines.slice(i+1,i+7),stop=next.findIndex(keyFor);
  const r=parseRow([lines[i],...(stop<0?next:next.slice(0,stop))],capturedAt);
  if(r&&!out[r.key]){const {key,...quote}=r;out[key]=quote;}
 }return out;
}
const complete=m=>REQUIRED.every(k=>m&&m[k]);
const num=(n,min=2,max=min)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:min,maximumFractionDigits:max});
const signed=(n,d=2)=>`${n>=0?'+':''}${num(n,d)}`;
const pct=n=>`${signed(n)}%`;
// Keep the full source timestamp in market.json but show only MM/DD on the newspaper.
const shortDate=date=>{const m=String(date??'').match(/(?:^|\/)\d{2}\/\d{2}/);return m?m[0].replace(/^\//,''):'';};
function displayed(item,key){
 if(!item)return `${key} —`;const date=`（${shortDate(item.date)}）`;
 if(key==='日経平均株価'||key==='NYダウ')return `${key} ${num(item.value)} ${signed(item.change)} ${pct(item.percent)} ${date}`;
 if(key==='日経225指数先物')return `${key} ${num(Math.trunc(item.value),0)} ${date}`;
 if(key==='米ドル円')return `${key} ${num(item.value,2,4)} ${date}`;
 if(key==='原油')return `${key} ${num(item.value)} ${signed(item.change)} ${date}`;
 if(key==='日本国債10年'||key==='米国債10年'||key==='米国10年国債')return `${key} ${item.value===null||item.value===undefined?'—':num(item.value,2)}% ${item.change===null||item.change===undefined?'—':signed(item.change,3)} ${date}`;
 return `${key} ${pct(item.percent)} ${date}`;
}
module.exports={URLS,REQUIRED,clean,keyFor,quoteDate,parseRow,extractRows,extractFallback,complete,displayed,shortDate};
