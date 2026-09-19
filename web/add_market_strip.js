'use strict';
// Add the same two-line market ribbon to the news page and newspaper masthead.
const fs=require('fs');
const path=require('path');
const {displayed,complete}=require('../market/matsui');
const ROOT=path.join(__dirname,'..');
const source=path.join(ROOT,'market.json');
if(!fs.existsSync(source)) {console.log('No market.json yet; market ribbon skipped.');process.exit(0);}
const data=JSON.parse(fs.readFileSync(source,'utf8'));
if(!complete(data.markets||{})) {console.log('Incomplete market.json; market ribbon skipped.');process.exit(0);}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=[
  [['日経平均株価','nikkei'],['日経225指数先物','nikkeiFutures'],['TOPIX','topix']],
  [['NYダウ','dow'],['S&P500','sp500'],['NASDAQ','nasdaq'],['米ドル円','usdjpy']],
];
const strip='<div class="market-strip" aria-label="株価指数・為替（各数値に更新日時を併記）">'+rows.map((row,i)=>
  `<div class="market-strip-row" data-row="${i+1}">`+row.map(([label,key])=>
    `<span class="market-quote">${escape(displayed(data.markets[key],label))}</span>`).join('')+'</div>').join('')+'</div>';
const css='<style id="market-strip-style">.market-strip{width:100%;font:10px/1.3 sans-serif;text-align:center;border-bottom:1px solid #222;padding:2px 0 3px}.market-strip-row{display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:0;white-space:nowrap}.market-quote{display:inline-block;padding:2px 5px;border-right:1px solid #888}.market-quote:last-child{border-right:0}@media screen and (max-width:800px){.market-strip{overflow-x:auto;text-align:left}.market-strip-row{justify-content:flex-start;width:max-content;min-width:100%}.market-quote{padding:3px 5px}}@media print{.market-strip{font-size:7pt;overflow:visible}.market-strip-row{justify-content:center;white-space:normal}.market-quote{padding:1px 3px}}</style>';
for(const [file,anchor] of [['index.html',/(<div class="update-time">[^<]*<\/div>)/],['paper-newspaper.html',/(<header class="masthead">[\s\S]*?<\/header>)/]]) {
  const location=path.join(ROOT,file);
  let html=fs.readFileSync(location,'utf8');
  html=html.replace(/<style id="market-strip-style">[\s\S]*?<\/style>/g,'');
  html=html.replace(/<div class="market-strip"[\s\S]*?<\/div><\/div>/g,'');
  if(!anchor.test(html)) throw new Error(`Masthead insertion point not found in ${file}`);
  html=html.replace('</head>',css+'\n</head>').replace(anchor,'$1\n'+strip);
  fs.writeFileSync(location,html);
  console.log(`Added two market rows to ${file}`);
}
