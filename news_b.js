// ●ブルームバーグ
// npm i playwright

const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    const url = 'https://www.bloomberg.com/jp/latest';

    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    const context = await browser.newContext({
      locale: 'ja-JP',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      screen: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    // ボット検出回避スクリプト
    await context.addInitScript(() => {
      // navigator.webdriver を隠す
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // chrome オブジェクトを偽装
      window.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: { isInstalled: false },
      };

      // plugins を偽装
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          {
            name: 'Chrome PDF Viewer',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });

      // languages を偽装
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja', 'en-US', 'en'],
      });

      // permissions.query を偽装
      const origQuery = navigator.permissions.query.bind(
        navigator.permissions
      );
      navigator.permissions.query = (params) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : origQuery(params);
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page
      .waitForLoadState('networkidle', { timeout: 30000 })
      .catch(() => {});

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

    await page.waitForTimeout(3000);

    // ボット検出ページかチェック
    const checkText = await page.innerText('body');
    if (
      checkText.includes('unusual activity') ||
      checkText.includes('not a robot')
    ) {
      console.warn('WARN: ボット検出ページが表示されました。リトライします...');
      // ページリロードで再試行
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page
        .waitForLoadState('networkidle', { timeout: 30000 })
        .catch(() => {});
      await page.waitForTimeout(3000);
    }

    // ブルームバーグは body 全文の取得が空になるケースがあるため、見出し・本文候補を優先取得
    const candidates = await page
      .locator(
        'main h1, main h2, main h3, article h1, article h2, article h3, main p, article p, li'
      )
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

    // ボット検出コンテンツを除外
    lines = lines.filter(
      (line) =>
        !line.includes('unusual activity') &&
        !line.includes('not a robot') &&
        !line.includes('Block reference ID')
    );

    if (!lines.length) {
      throw new Error(
        'ページ本文の取得結果が空です（ボット検出でブロックされた可能性があります）'
      );
    }

    const filename = 'news_b.csv';
    let csvContent = '\uFEFF'; // BOM
    for (const line of lines) {
      csvContent += `"${line.replace(/"/g, '""')}"\n`;
    }

    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log('saved:', filename, `(lines=${lines.length})`);

    await context.close();
  } catch (err) {
    console.error(`ERROR in news_b: ${err.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
