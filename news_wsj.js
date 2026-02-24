// ●WSJ
// npm i playwright

const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    const url = 'https://jp.wsj.com/news/whats-news';

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: 'ja-JP',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    // 同意ポップアップがある場合は閉じる
    const consentSelectors = [
      'button:has-text("Accept")',
      'button:has-text("I Agree")',
      'button:has-text("同意")',
      '#onetrust-accept-btn-handler',
    ];
    for (const selector of consentSelectors) {
      const button = page.locator(selector).first();
      if (await button.count()) {
        await button.click({ timeout: 1500 }).catch(() => {});
        break;
      }
    }

    await page.waitForTimeout(2500);

    // WSJは body 全文の取得が空になるケースがあるため、見出し・本文候補を優先取得
    const candidates = await page
      .locator('main h1, main h2, main h3, article h1, article h2, article h3, main p, article p, li')
      .allInnerTexts();

    let lines = candidates
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // 見出し抽出が空の場合は body 取得にフォールバック
    if (lines.length < 10) {
      const bodyText = await page.evaluate(() => {
        const body = document.querySelector('body');
        return body ? body.innerText : '';
      });
      lines = bodyText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }

    if (!lines.length) {
      throw new Error('ページ本文の取得結果が空です');
    }

    const filename = 'news_wsj.csv';
    let csvContent = '\uFEFF'; // BOM
    for (const line of lines) {
      csvContent += `"${line.replace(/"/g, '""')}"\n`;
    }

    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log('saved:', filename, `(lines=${lines.length})`);

    await context.close();
  } catch (err) {
    console.error(`ERROR in news_wsj: ${err.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
