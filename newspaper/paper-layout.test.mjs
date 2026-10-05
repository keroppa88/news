import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1600}});
 await page.route('http://paper.test/**',async route=>{
  const path=new URL(route.request().url()).pathname.slice(1)||'paper-newspaper.html';
  try{await route.fulfill({body:await fs.readFile(path),contentType:path.endsWith('.json')?'application/json':path.endsWith('.html')?'text/html':path.endsWith('.png')?'image/png':'font/ttf'});}catch{await route.fulfill({status:404,body:''});}
 });
 await page.goto('http://paper.test/paper-newspaper.html');
 await page.waitForSelector('.front-page');
 await page.evaluate(()=>document.fonts.ready);
 await page.emulateMedia({media:'print'});
 await page.evaluate(()=>refit());
 const result=await page.evaluate(()=>{
  const paper=document.querySelector('.paper').getBoundingClientRect(),grid=document.querySelector('.important-cartoon-grid'),figure=document.querySelector('.paper-cartoon'),image=figure?.querySelector('img');
  return {height:paper.height,width:paper.width,important:document.querySelectorAll('.front-page .story,.front-page .headline-only').length,others:document.querySelectorAll('.supplement .story').length,cartoon:!!figure,title:figure?.querySelector('figcaption').textContent,grid:!!grid,imageLoaded:image?.complete&&image.naturalWidth>0,figureWidth:figure?.getBoundingClientRect().width,gridWidth:grid?.getBoundingClientRect().width,captionBorders:figure?getComputedStyle(figure.querySelector('figcaption')).borderTopWidth:null,ranking:document.querySelector('.ycomment')?.children.length-1};
 });
 console.log('Paper layout:',JSON.stringify(result));
 const data=JSON.parse(await fs.readFile('newspaper.json','utf8'));
 assert.equal(result.important,Math.min(data.important.length,20));
 assert.equal(result.others,Math.max(data.others.length-3,0));
 assert.ok(result.cartoon&&result.grid&&result.title&&result.imageLoaded,'Cartoon and Japanese caption must load');
 assert.ok(result.figureWidth/result.gridWidth<0.34,'Cartoon must use only one third of paper width');
 assert.match(result.title,/^「.*」$/);
 assert.equal(result.captionBorders,'0px');
 assert.ok(result.height<=1123.6,'Paper must fit one A4 page without dropping important articles');
 await page.screenshot({path:'/tmp/paper-layout.png',fullPage:true});
 const pdf=await page.pdf({preferCSSPageSize:true});
 const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
 assert.equal(pages,1,'Printed newspaper must be one A4 page');
 console.log('Verified all important articles, one fewer Others row, cartoon and one A4 page.');
}finally{await browser.close();}
