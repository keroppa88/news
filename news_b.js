// ●ブルームバーグ
// npm i playwright

const { chromium } = require('playwright');
const fs = require('fs');

// ボット検出ページの判定キーワード（2つ以上マッチでブロックと判定）
const BLOCK_MARKERS = [
  'unusual activity',
  'not a robot',
  'Block reference ID',
  'Why did this happen?',
  'Please make sure your browser supports JavaScript and cookies',
];

function isBlockedPage(text) {
  let hits = 0;
  for (const kw of BLOCK_MARKERS) {
    if (text.includes(kw)) hits++;
  }
  return hits >= 2;
}

async function launchBrowser() {
  const baseArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ];

  // ★ headless: false（実ブラウザモード）が最も検出されにくい
  //   --start-minimized でウィンドウを最小化して起動

  // 1) Google Chrome（実ブラウザモード）
  try {
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: [...baseArgs, '--start-minimized'],
    });
    console.log('INFO: Google Chrome（実ブラウザモード）を使用');
    return browser;
  } catch (_) {}

  // 2) Chromium（実ブラウザモード）
  try {
    const browser = await chromium.launch({
      headless: false,
      args: [...baseArgs, '--start-minimized'],
    });
    console.log('INFO: Chromium（実ブラウザモード）を使用');
    return browser;
  } catch (_) {}

  // 3) 最終フォールバック: headless（検出される可能性あり）
  const browser = await chromium.launch({
    headless: true,
    args: baseArgs,
  });
  console.log('WARN: headless モードで起動（ボット検出される可能性あり）');
  return browser;
}

(async () => {
  let browser;
  try {
    const url = 'https://www.bloomberg.com/jp/latest';

    browser = await launchBrowser();
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
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: { isInstalled: false },
      };
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
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja', 'en-US', 'en'],
      });
      const origQuery = navigator.permissions.query.bind(
        navigator.permissions
      );
      navigator.permissions.query = (params) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : origQuery(params);
    });

    const page = await context.newPage();

    // 最大2回試行
    let bodyText = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 0) {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
      } else {
        console.warn('WARN: ボット検出。リトライします...');
        await page.waitForTimeout(2000);
        await page.reload({
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
      }
      await page
        .waitForLoadState('networkidle', { timeout: 30000 })
        .catch(() => {});

      // 同意ポップアップを閉じる
      for (const selector of [
        'button:has-text("Accept")',
        'button:has-text("I Agree")',
        'button:has-text("同意")',
        '#onetrust-accept-btn-handler',
      ]) {
        const button = page.locator(selector).first();
        if (await button.count()) {
          await button.click({ timeout: 1500 }).catch(() => {});
          break;
        }
      }

      await page.waitForTimeout(3000);
      bodyText = await page.innerText('body');

      if (!isBlockedPage(bodyText)) break;
    }

    if (isBlockedPage(bodyText)) {
      throw new Error('ボット検出によりアクセスがブロックされました');
    }

    // 見出し・本文候補を優先取得
    const candidates = await page
      .locator(
        'main h1, main h2, main h3, article h1, article h2, article h3, main p, article p, li'
      )
      .allInnerTexts();

    let lines = candidates
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // 見出し抽出が空の場合は body にフォールバック
    if (lines.length < 10) {
      lines = bodyText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }

    if (!lines.length) {
      throw new Error('ページ本文の取得結果が空です');
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
