import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1600}});
 await page.route('http://localhost/**',async route=>{
  const path=new URL(route.request().url()).pathname.slice(1)||'paper-newspaper.html';
  try{await route.fulfill({body:await fs.readFile(path),contentType:path.endsWith('.json')?'application/json':path.endsWith('.html')?'text/html':path.endsWith('.png')?'image/png':'font/ttf'});}catch{await route.fulfill({status:404,body:''});}
 });
 await page.goto('http://localhost/paper-newspaper.html');
 await page.waitForSelector('.front-page').catch(async error=>{console.error('Paper render failed:',await page.locator('#content').textContent());throw error;});
 await page.evaluate(()=>document.fonts.ready);
 await page.emulateMedia({media:'print'});
 await page.evaluate(()=>refit());
 const result=await page.evaluate(()=>{
  const paper=document.querySelector('.paper').getBoundingClientRect();
  const rankingBox=document.querySelector('.ycomment'),padding=parseFloat(getComputedStyle(document.querySelector('.paper')).paddingBottom);
  const limit=paper.top+297*(padding/5)-padding;
  return {rankingGap:limit-rankingBox.getBoundingClientRect().bottom,rankingLineHeight:parseFloat(getComputedStyle(rankingBox).lineHeight),height:paper.height,width:paper.width,important:document.querySelectorAll('.front-page .story,.front-page .headline-only').length,others:document.querySelectorAll('.supplement .story').length,ranking:document.querySelector('.ycomment')?.children.length-1};
 });
 console.log('Paper layout:',JSON.stringify(result));
 const data=JSON.parse(await fs.readFile('newspaper.json','utf8'));
 assert.equal(result.important,Math.min(data.important.length,20));
 assert.equal(result.others,Math.min(data.others.length,9));
 const available=(JSON.parse(await fs.readFile('ycomment.json','utf8')).titles||[]).length;
 if(result.ranking>0&&result.ranking<available){
  assert.ok(result.rankingGap>=-1&&result.rankingGap<result.rankingLineHeight+2,'Ranking must fill remaining A4 space to within one line');
 }
 assert.ok(result.height<=1123.6,'Paper must fit one A4 page without dropping important articles');
 await page.screenshot({path:'/tmp/paper-layout.png',fullPage:true});
 const pdf=await page.pdf({preferCSSPageSize:true});
 const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
 assert.equal(pages,1,'Printed newspaper must be one A4 page');
 console.log('Verified all important articles, one fewer Others row and one A4 page.');
}finally{await browser.close();}

