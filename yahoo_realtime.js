const { chromium } = require('playwright');
const fs = require('fs');

const KEYWORDS = ['キオクシア', '日経平均', 'フジクラ', 'NISA', '追証', 'オルカン', '高市', '弥助'];
const OUTPUT_FILE = 'ヤフーリアルタイム.csv';

function jstDateTimeString() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const date = d.toISOString().split('T')[0];
  const time = d.toISOString().split('T')[1].slice(0, 8);
  return `${date} ${time}`;
}

function csvCell(str) {
  return `"${String(str).replace(/"/g, '""')}"`;
}

// ページテキストから「N件のポスト」の最初の数値を抽出
function extractCount(text) {
  const m = text.match(/([\d,]+)件のポスト/);
  return m ? m[1].replace(/,/g, '') : '';
}

(async () => {
  let browser;
  try {
    // ファイルが存在しない場合はヘッダー行を書く
    if (!fs.existsSync(OUTPUT_FILE)) {
      const header = ['保存日時', ...KEYWORDS].map(csvCell).join(',') + '\n';
      fs.writeFileSync(OUTPUT_FILE, '﻿' + header, 'utf8');
    }

    const launchOpts = { headless: true };
    if (process.env.HTTPS_PROXY) {
      launchOpts.proxy = { server: process.env.HTTPS_PROXY };
    }
    browser = await chromium.launch(launchOpts);

    const datetime = jstDateTimeString();
    const cells = [csvCell(datetime)];

    for (const keyword of KEYWORDS) {
      let page;
      let count = '';
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
          console.log(`24時間ボタン未検出 (${keyword})`);
        }

        const text = await page.innerText('body');
        count = extractCount(text);
        console.log(`ok: ${keyword} → ${count}件`);
      } catch (err) {
        console.error(`ERROR (${keyword}): ${err.message}`);
      } finally {
        if (page) await page.close();
      }

      cells.push(csvCell(count));
      await new Promise(r => setTimeout(r, 2000));
    }

    fs.appendFileSync(OUTPUT_FILE, cells.join(',') + '\n', 'utf8');
    console.log(`saved: ${OUTPUT_FILE}`);
  } catch (err) {
    console.error(`ERROR in yahoo_realtime: ${err.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
