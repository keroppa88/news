const { chromium } = require('playwright');
const fs = require('fs');

const KEYWORDS = ['キオクシア', '日経平均', 'フジクラ', 'NISA', '追証', 'オルカン', '高市'];
const OUTPUT_FILE = 'ヤフーリアルタイム.csv';
const CSV_HEADER = '﻿保存日時,キーワード,取得テキスト\n';

function jstDateTimeString() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const date = d.toISOString().split('T')[0];
  const time = d.toISOString().split('T')[1].slice(0, 8);
  return `${date} ${time}`;
}

(async () => {
  let browser;
  try {
    if (!fs.existsSync(OUTPUT_FILE)) {
      fs.writeFileSync(OUTPUT_FILE, CSV_HEADER, 'utf8');
    }

    browser = await chromium.launch({ headless: true });
    const datetime = jstDateTimeString();

    for (const keyword of KEYWORDS) {
      let page;
      try {
        const url = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(keyword)}&aq=-1&ei=UTF-8&ifr=tl_sc&chart=1`;
        page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);

        // 24時間ボタンをクリック（失敗しても続行）
        try {
          await page.locator('text=24時間').first().click();
          await page.waitForTimeout(2000);
        } catch (e) {
          console.log(`24時間ボタン未検出 (${keyword}): ${e.message}`);
        }

        const text = await page.innerText('body');
        const escaped = text.replace(/"/g, '""');
        fs.appendFileSync(OUTPUT_FILE, `"${datetime}","${keyword}","${escaped}"\n`, 'utf8');
        console.log(`saved: ${keyword}`);
      } catch (err) {
        console.error(`ERROR (${keyword}): ${err.message}`);
      } finally {
        if (page) await page.close();
      }

      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error(`ERROR in yahoo_realtime: ${err.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
