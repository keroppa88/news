'use strict';
// Add Rakuten market quotations directly below the newspaper masthead.
const fs=require('fs');
const path=require('path');
const {displayed}=require('../market/rakuten');
const ROOT=path.join(__dirname,'..');
let markets={};
try{markets=JSON.parse(fs.readFileSync(path.join(ROOT,'market.json'),'utf8')).markets||{};}
catch(e){console.warn(`Market snapshot unavailable: ${e.message}`);}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Provisional ordering; three rows accommodate ten requested indicators.
const rows=[
 [['日経平均株価','nikkei'],['日経225指数先物','nikkeiFutures'],['TOPIX','topix']],
 [['NYダウ','dow'],['S&P500','sp500'],['NASDAQ','nasdaq']],
 [['米ドル円','usdjpy'],['原油','oil'],['日本国債10年','jgb10'],['米国債10年','ust10']],
];
const strip='<!-- MARKET_STRIP_START --><div class="market-strip" aria-label="株価指数・為替・原油・国債（日付は月日表示）">'+rows.map((row,i)=>
 `<div class="market-strip-row" data-row="${i+1}">`+row.map(([label,key])=>
  `<span class="market-quote">${esc(displayed(markets[key],label))}</span>`).join('')+'</div>').join('')+'</div><!-- MARKET_STRIP_END -->';
const css='<style id="market-strip-style">.market-strip{width:100%;font:9px/1.35 sans-serif;text-align:center;border-bottom:1px solid #222;padding:2px 0 3px}.market-strip-row{display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:0;white-space:nowrap}.market-quote{display:inline-block;padding:2px 4px;border-right:1px solid #888}.market-quote:last-child{border-right:0}@media screen and (max-width:850px){.market-strip{overflow-x:auto;text-align:left}.market-strip-row{justify-content:flex-start;width:max-content;min-width:100%}.market-quote{padding:3px 5px}}@media print{.market-strip{font-size:6.5pt;overflow:visible}.market-strip-row{justify-content:center;white-space:normal}.market-quote{padding:1px 2px}}</style>';
for(const [file,anchor] of [['index.html',/(<div class="update-time">[^<]*<\/div>)/],['paper-newspaper.html',/(<header class="masthead">[\s\S]*?<\/header>)/]]){
 const filename=path.join(ROOT,file);let html=fs.readFileSync(filename,'utf8');
 html=html.replace(/<style id="market-strip-style">[\s\S]*?<\/style>/g,'');
 html=html.replace(/<!-- MARKET_STRIP_START -->[\s\S]*?<!-- MARKET_STRIP_END -->/g,'');
 // Remove the earlier two-row Matsui implementation, if present.
 html=html.replace(/<div class="market-strip"[\s\S]*?<\/div><\/div>/g,'');
 if(!anchor.test(html))throw Error(`Masthead insertion point not found in ${file}`);
 html=html.replace('</head>',css+'\n</head>').replace(anchor,'$1\n'+strip);
 fs.writeFileSync(filename,html);
 console.log(`Added three Rakuten market rows to ${file}`);
}
