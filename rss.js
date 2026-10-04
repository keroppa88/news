// rss.js: RSSから見出しを取得してCSV保存する共通処理
// サイト本体のページはボット判定で遮断されるため、RSS（配信用データ）から取得する。
// Run.js は news_*.js だけを実行するので、このファイル自体は実行されない。

const fs = require('fs');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Googleニュース検索のRSSアドレスを作る
function googleNewsUrl(query, lang = 'ja') {
  const loc = lang === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=ja&gl=JP&ceid=JP:ja';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`;
}

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(item, name) {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
}

// 日本時間の "10/2 07:30" 形式
function jst(date) {
  const d = new Date(date.getTime() + 9 * 3600 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hh}:${mm}`;
}

// 日本時間の前日0時（これより古い記事は取得しない＝前日と本日分のみ）
function startOfYesterdayJst() {
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  return Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() - 1) - 9 * 3600 * 1000;
}

// Googleニュースは連続アクセスで一時的に 503/429 を返すことがあるので、間を空けて取り直す
async function fetchWithRetry(url, waits = [15000, 45000]) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= waits.length) throw new Error(`HTTP ${res.status}`);
    console.error(`retry after HTTP ${res.status} (${waits[attempt] / 1000}s): ${url}`);
    await new Promise((r) => setTimeout(r, waits[attempt]));
  }
}

// options:
//   name      ログ用の名前（例: news_r）
//   file      保存するCSVファイル名
//   urls      RSSアドレスの配列。{ url, label } にすると見出しの先頭に [label] を付ける
//   perFeed   1つのRSSから取る最大件数（既定 なし）
//   max       保存する最大件数（既定 60）
//   exclude   除外する見出しの正規表現
//   keepSource true なら Googleニュースの「 - 媒体名」を残す
async function saveRss({ name, file, urls, max = 60, perFeed, exclude, keepSource = false }) {
  try {
    const since = startOfYesterdayJst();
    const items = [];
    for (const entry of urls) {
      const { url, label } = typeof entry === 'string' ? { url: entry } : entry;
      let xml;
      try {
        xml = await fetchWithRetry(url);
      } catch (err) {
        // 1つのRSSが失敗しても他は続ける（全部失敗したら下でエラー）
        console.error(`WARN in ${name}: ${err.message}: ${url}`);
        continue;
      }
      const feedItems = [];
      for (const m of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/g)) {
        let title = tag(m[1], 'title');
        const source = tag(m[1], 'source');
        if (!keepSource && source && title.endsWith(` - ${source}`)) {
          title = title.slice(0, -(source.length + 3));
        }
        // RSS2.0 は pubDate、RSS1.0（rss.wor.jp）は dc:date
        const date = new Date(tag(m[1], 'pubDate') || tag(m[1], 'dc:date'));
        if (!isNaN(date) && date.getTime() < since) continue;
        feedItems.push({ title, label, date });
      }
      items.push(...(perFeed ? feedItems.slice(0, perFeed) : feedItems));
    }

    const seen = new Set();
    const lines = items
      .filter((it) => it.title && !(exclude && exclude.test(it.title)))
      .sort((a, b) => (b.date.getTime() || 0) - (a.date.getTime() || 0))
      .filter((it) => !seen.has(it.title) && seen.add(it.title))
      .slice(0, max)
      .map((it) => {
        const head = it.label ? `[${it.label}] ${it.title}` : it.title;
        return isNaN(it.date) ? head : `${head}（${jst(it.date)}）`;
      });

    if (!lines.length) throw new Error('RSSから見出しを取得できませんでした');

    let csvContent = '\uFEFF'; // BOM
    for (const line of lines) {
      csvContent += `"${line.replace(/"/g, '""')}"\n`;
    }
    fs.writeFileSync(file, csvContent, 'utf8');
    console.log('saved:', file, `(lines=${lines.length})`);
  } catch (err) {
    // 古いデータが混ざらないよう空にしてから失敗を返す
    fs.writeFileSync(file, '\uFEFF', 'utf8');
    console.error(`ERROR in ${name}: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { saveRss, googleNewsUrl };
