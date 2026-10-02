// ●ヤフコメランキング（コメント数の多いニュース）
// 紙新聞の余白に見出しだけを並べるため ycomment.json に保存する。
// Run.js は news_*.js だけを実行するので、このファイルはワークフローから直接呼ぶ。

const fs = require('fs');

const URL = 'https://news.yahoo.co.jp/ranking/comment';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

(async () => {
  try {
    const res = await fetch(URL, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja-JP,ja;q=0.9' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // ランキング1件ごとの塊から、最初に出てくる文字だけの <div> を見出しとして取る
    const titles = [];
    for (const chunk of html.split('newsFeed_item_body').slice(1)) {
      const m = chunk.match(/<div class="[^"]*">([^<]{4,})<\/div>/);
      if (m) titles.push(decode(m[1]));
    }
    if (!titles.length) throw new Error('見出しを取得できませんでした');

    fs.writeFileSync('ycomment.json', JSON.stringify({ updatedAt: new Date().toISOString(), titles }, null, 2) + '\n');
    console.log('saved: ycomment.json', `(titles=${titles.length})`);
  } catch (err) {
    // 失敗しても前回分は残す（紙面には古い日付のランキングが出るだけ）
    console.error(`ERROR in yahoo_comment_ranking: ${err.message}`);
    process.exit(1);
  }
})();
