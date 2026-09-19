'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {extractRows,extractFallback,fxTimestamp,complete,displayed,dateOf}=require('./matsui');
const now='2026-09-19T09:00:00.000Z';
const rows=[
 ['日経平均株価','62,364.92','-2,566.27 (-3.95%)','07/28 15:30'],
 ['日経225指数先物','62,480.00','+80.00','+0.13%','07/28 21:11'],
 ['TOPIX(東証株価指数)','3,963.59','-102.48 (-2.52%)','07/28 15:30'],
 ['NYダウ','52,210.08','+262.83 (+0.51%)','07/27'],
 ['NASDAQ','24,932.08','-43.74 (-0.18%)','07/27'],
 ['S&P500','7,413.18','+1.2 (+0.02%)','07/27'],
 ['米ドル','買163.9030','売163.9010','+0.1520(+0.0928％)','時系列データ']
];
test('all seven quotes from Matsui table, Bid forex, and index-specific dates',()=>{
 const m=extractRows(rows,now,'2026/09/19 18:00');
 assert.equal(complete(m),true);
 assert.deepEqual(m.nikkei,{value:62364.92,change:-2566.27,percent:-3.95,date:'2026/07/28 15:30'});
 assert.deepEqual(m.usdjpy,{value:163.901,change:0.152,date:'2026/09/19 18:00'});
 assert.equal(m.sp500.percent,0.02);
 assert.match(displayed(m.dow,'NYダウ'),/\+262\.83 \+0\.51%/);
});
test('year rollover and forex timestamp',()=>{
 assert.equal(dateOf('12/31 15:30','2027-01-01T06:00:00Z'),'2026/12/31 15:30');
 assert.equal(fxTimestamp('対円レート\n2026/9/19 03:58\n通貨ペア',now),'2026/09/19 03:58');
});
test('reject missing price, rate, timestamp instead of inventing data',()=>{
 assert.equal(complete(extractRows([['TOPIX','-','-','07/28 15:30']],now,null)),false);
});
test('fallback parses plain text copied from the full page',()=>{
 const text='海外株価指数 更新\nNYダウ\n52,210.08\n+262.83 (+0.51%)\n07/27\nNASDAQ\n24,932.08\n-43.74 (-0.18%)\n07/27';
 const m=extractFallback(text,now,null);
 assert.equal(m.dow.change,262.83);
 assert.equal(m.nasdaq.percent,-0.18);
});
