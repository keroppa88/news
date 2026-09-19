'use strict';
// Copy rendered public Rakuten market pages and publish only the ten requested quotations.
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const {URLS,REQUIRED,extractRows,extractFallback}=require('./rakuten');
const OUT=path.join(__dirname,'..','market.json');
const capturedAt=new Date().toISOString();
const allowed={index:new Set(['nikkei','topix','dow','sp500','nasdaq']),future:new Set(['nikkeiFutures']),commodities:new Set(['oil']),bond:new Set(['jgb10','ust10']),exchange:new Set(['usdjpy'])};
async function snapshot(frame){
 try{return await frame.evaluate(()=>({
  text:document.body?.innerText||'',
  rows:[...document.querySelectorAll('table tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>c.innerText.trim())),
 }));}catch(e){console.warn(`Could not copy frame ${frame.url()}: ${e.message}`);return {text:'',rows:[]};}
}
async function visit(page,url){
 try{
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
  if(r&&r.status()>=400)throw Error(`HTTP ${r.status()}`);
  // Quote tables are populated by JavaScript after the initial HTML loads.
  await page.waitForTimeout(5000);
  const copies=[];for(const frame of page.frames())copies.push({url:frame.url(),...await snapshot(frame)});
  console.log(`Copied ${url}: ${copies.length} frame(s), ${copies.reduce((n,c)=>n+c.rows.length,0)} table rows`);
  return copies;
 }catch(e){console.warn(`Unavailable ${url}: ${e.message}`);return [];}
}
async function main(){
 let previous={};try{previous=JSON.parse(fs.readFileSync(OUT,'utf8')).markets||{};}catch{}
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({locale:'ja-JP',timezoneId:'Asia/Tokyo'});
 page.on('response',r=>{if(r.status()>=400&&/rakuten-sec\.co\.jp/.test(r.url()))console.warn(`Quote resource HTTP ${r.status()}: ${r.url().slice(0,180)}`);});
 const markets={...previous};let fresh=0;
 try{
  for(const [group,url] of Object.entries(URLS)){
   const copies=await visit(page,url),text=copies.map(c=>c.text).join('\n');
   const parsed={...extractFallback(text,capturedAt),...extractRows(copies.flatMap(c=>c.rows),capturedAt)};
   const found=[];
   for(const key of allowed[group])if(parsed[key]){markets[key]={...parsed[key],sourceUrl:url};fresh++;found.push(key);}
   console.log(`${group}: extracted ${found.join(', ')||'none'}`);
   if(found.length!==allowed[group].size){
    const rows=copies.flatMap(c=>c.rows).filter(r=>r.some(c=>c&&!/^[-ー－\s]+$/.test(c))).slice(0,12);
    console.warn(`Diagnostic ${group}: sample rows ${JSON.stringify(rows).slice(0,2400)}`);
    console.warn(`Diagnostic ${group}: frames ${copies.map(c=>c.url).join(', ').slice(0,1100)}`);
    console.warn(`Diagnostic ${group}: text around quote table ${text.slice(Math.max(0,text.indexOf('指標')-100),Math.max(0,text.indexOf('指標')-100)+900).replace(/\n/g,' | ')}`);
   }
  }
 }finally{await browser.close();}
 const missing=REQUIRED.filter(k=>!markets[k]||(markets[k].change===null&&['jgb10','ust10'].includes(k)));
 if(!fresh)throw Error('No quotations extracted from Rakuten; previous market.json retained');
 const tmp=OUT+'.tmp';fs.writeFileSync(tmp,JSON.stringify({source:'楽天証券',sources:URLS,capturedAt,markets},null,2)+'\n');fs.renameSync(tmp,OUT);
 console.log(`Updated market.json: ${fresh}/10 records; unavailable values: ${missing.join(', ')||'none'}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
