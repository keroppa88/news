'use strict';
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const {SOURCE,MAIN_TABLE,FX_TABLE,REQUIRED,extractRows,extractFallback,fxTimestamp,complete}=require('./matsui');
const OUT=path.join(__dirname,'..','market.json');
const EXTRA=[MAIN_TABLE,FX_TABLE,'https://finance.matsui.co.jp/parts/major-index-chart','https://finance.matsui.co.jp/stock/index','https://finance.matsui.co.jp/stock-overseas/index','https://finance.matsui.co.jp/future/index'];
const capturedAt=new Date().toISOString();
async function snapshot(frame,url){
  try{
    const data=await frame.evaluate(()=>({
      text:document.body?.innerText||'',
      rows:[...document.querySelectorAll('table tr')].map(row=>[...row.querySelectorAll('th,td')].map(cell=>cell.innerText.trim()))
    }));
    return data.text.trim()?{url,...data}:null;
  }catch(err){console.warn(`Could not read ${url}: ${err.message}`);return null;}
}
async function visit(page,url){
  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    if(response&&response.status()>=400)throw new Error(`HTTP ${response.status()}`);
    await page.waitForTimeout(1800);
    const copies=[];
    for(const frame of page.frames()){
      const copy=await snapshot(frame,frame.url()||url);
      if(copy)copies.push(copy);
    }
    console.log(`Read complete rendered text from ${url}: ${copies.length} documents`);
    return copies;
  }catch(err){console.warn(`Unavailable ${url}: ${err.message}`);return [];}
}
async function main(){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({locale:'ja-JP',timezoneId:'Asia/Tokyo'});
  const pages=[];
  try{
    pages.push(...await visit(page,SOURCE));
    for(const url of EXTRA){
      pages.push(...await visit(page,url));
      const fxDate=pages.map(p=>fxTimestamp(p.text,capturedAt)).find(Boolean);
      const markets={...extractFallback(pages.map(p=>p.text).join('\n'),capturedAt,fxDate),...extractRows(pages.flatMap(p=>p.rows),capturedAt,fxDate)};
      if(complete(markets))break;
    }
  }finally{await browser.close();}
  const fxDate=pages.map(p=>fxTimestamp(p.text,capturedAt)).find(Boolean);
  const markets={...extractFallback(pages.map(p=>p.text).join('\n'),capturedAt,fxDate),...extractRows(pages.flatMap(p=>p.rows),capturedAt,fxDate)};
  const missing=REQUIRED.filter(key=>!markets[key]);
  if(missing.length)throw new Error(`Missing ${missing.join(', ')}; previous market.json retained`);
  const tmp=OUT+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify({source:SOURCE,capturedAt,markets},null,2)+'\n');
  fs.renameSync(tmp,OUT);
  console.log(`Updated market.json: ${REQUIRED.join(', ')}`);
}
main().catch(err=>{console.error(err);process.exitCode=1;});
