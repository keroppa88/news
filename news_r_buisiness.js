// ●ロイター国内
// npm i playwright

const { chromium } = require('playwright');
const fs = require('fs');

//●サイトアドレス
(async () => {
  let browser;
  try {
    const url = 'https://jp.reuters.com/business/';

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // ページを開く（軽めの待機設定）
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 数秒だけ待つ（描画・JS実行待機）
    await page.waitForTimeout(3000); // ← 必要に応じて秒数調整

    // ページ全体の表示テキストを取得
    const text = await page.innerText('body');

    // CSV保存（行ごと）●ファイルネーム
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const filename = `news_r_buisiness.csv`;

    // 改行ごとに1行として書き込む
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    let csvContent = '\uFEFF'; // BOM
    for (const line of lines) {
      csvContent += `"${line.replace(/"/g, '""')}"\n`;
    }

    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log('saved:', filename);
  } catch (err) {
    console.error(`ERROR in news_r_buisiness: ${err.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
