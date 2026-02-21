// ●ブルームバーグ（Google News RSS 経由）
// Bloomberg は CI 環境からのアクセスをボット検出でブロックするため、
// Google News RSS から Bloomberg Japan の記事を取得する方式に変更。
// ブラウザ不要・追加依存なし。

const https = require('https');
const fs = require('fs');

const RSS_URL =
  'https://news.google.com/rss/search?q=site:bloomberg.co.jp+when:1d&hl=ja&gl=JP&ceid=JP:ja';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('タイムアウト'));
    });
  });
}

function extractItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    // source タグから提供元を取得
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
    if (title) {
      items.push({
        title: decodeEntities(title.trim()),
        pubDate: pubDate.trim(),
        source: decodeEntities(source.trim()),
      });
    }
  }
  return items;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

(async () => {
  try {
    console.log('Google News RSS からブルームバーグ記事を取得中...');
    const xml = await fetch(RSS_URL);
    const items = extractItems(xml);

    if (!items.length) {
      throw new Error('記事が取得できませんでした');
    }

    const lines = [];
    lines.push('Bloomberg（Google News経由）');
    for (const item of items) {
      lines.push(item.title);
    }

    const filename = 'news_b.csv';
    let csvContent = '\uFEFF'; // BOM
    for (const line of lines) {
      csvContent += `"${line.replace(/"/g, '""')}"\n`;
    }

    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log('saved:', filename, `(articles=${items.length})`);
  } catch (err) {
    console.error(`ERROR in news_b: ${err.message}`);
    process.exit(1);
  }
})();
