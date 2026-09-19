'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {REQUIRED,keyFor,quoteDate,extractRows,extractFallback,complete,displayed,shortDate}=require('./rakuten');
const now='2026-09-19T09:00:00.000Z';
const rows=[
 ['日経平均株価','63,923.00','+438.90','+0.69%','2026/09/18 15:30'],
 ['日経225先物','64,210.99','-100.00','-0.16%','09/19 06:00'],
 ['TOPIX','4,121.00','+31.00','+0.76%','09/18 15:30'],
 ['NYダウ','50,123.00','-100.00','-0.20%','09/18 16:00'],
 ['S&P500','7,500.00','+10.00','+0.13%','09/18 16:00'],
 ['NASDAQ総合指数','24,900.00','-15.00','-0.06%','09/18 16:00'],
 ['米ドル/円','157.4500','157.5300','+0.3500','+0.22%','09/19 05:00'],
 ['WTI原油先物','92.34','-1.23','-1.31%','09/18 17:00'],
 ['日本国債10年','2.985','+0.009','+0.52%','09/18 15:30'],
 ['米国10年国債','5.000','-0.031','-0.72%','09/18 16:00'],
];
test('Rakuten table extracts all ten targeted instruments and exact columns',()=>{
 const m=extractRows(rows,now);
 assert.equal(REQUIRED.length,10);assert.equal(complete(m),true);
 assert.deepEqual(m.nikkei,{value:63923,change:438.9,percent:0.69,date:'2026/09/18 15:30'});
 assert.deepEqual(m.usdjpy,{value:157.45,change:0.35,date:'2026/09/19 05:00'});
 assert.deepEqual(m.oil,{value:92.34,change:-1.23,date:'2026/09/18 17:00'});
 assert.deepEqual(m.jgb10,{value:2.985,change:0.009,date:'2026/09/18 15:30'});
 assert.deepEqual(m.ust10,{value:5,change:-0.031,date:'2026/09/18 16:00'});
 assert.match(displayed(m.oil,'原油'),/原油 92\.34 -1\.23/);
});
test('FX columns: buy and prior-day buy change, never the sell quote',()=>{
 const m=extractRows([['米ドル/円','156.8500','156.9300','-0.1200','-0.08%','09/19 06:00']],now);
 assert.deepEqual(m.usdjpy,{value:156.85,change:-0.12,date:'2026/09/19 06:00'});
 assert.equal(extractRows([['米ドル/円','156.8500','156.9300','--','--','09/19 06:00']],now).usdjpy,undefined);
});
test('Missing daily bond change preserves the yield and short date',()=>{
 assert.equal(complete(extractRows([['NYダウ','-','-','-','-']],now)),false);
 const m=extractRows([['日本国債10年','2.985','--','09/18 15:30']],now);
 assert.deepEqual(m.jgb10,{value:2.985,change:null,date:'2026/09/18 15:30'});
 assert.equal(displayed(m.jgb10,'日本国債10年'),'日本国債10年 2.99% — （09/18）');
 assert.equal(displayed({value:5,change:null,date:'2026/09/19 06:05'},'米国債10年'),'米国債10年 5.00% — （09/19）');
});
test('All displayed dates omit year/time; futures truncated, FX has no change',()=>{
 const m=extractRows(rows,now);
 assert.equal(shortDate('2026/09/18 15:30'),'09/18');
 assert.equal(displayed(m.nikkeiFutures,'日経225指数先物'),'日経225指数先物 64,210 （09/19）');
 assert.equal(displayed(m.usdjpy,'米ドル円'),'米ドル円 157.45 （09/19）');
 assert.equal(displayed(m.jgb10,'日本国債10年'),'日本国債10年 2.99% +0.009 （09/18）');
 assert.equal(displayed(m.ust10,'米国債10年'),'米国債10年 5.00% -0.031 （09/18）');
 for(const [key,label] of [['nikkei','日経平均株価'],['topix','TOPIX'],['dow','NYダウ'],['sp500','S&P500'],['nasdaq','NASDAQ'],['oil','原油']]){
  const output=displayed(m[key],label);assert.doesNotMatch(output,/2026|\d{2}:\d{2}/);assert.match(output,/（09\/18）/);
 }
});
test('Plain text fallback, S&P500指数, and year rollover',()=>{
 assert.equal(quoteDate('12/31 15:30','2027-01-01T06:00:00Z'),'2026/12/31 15:30');
 const m=extractFallback('WTI原油先物\n92.34\n-1.23\n-1.31%\n09/18 17:00',now);
 assert.equal(m.oil.value,92.34);
 assert.equal(keyFor('米国10年国債'),'ust10');
 assert.equal(keyFor('S&P500指数'),'sp500');
});
