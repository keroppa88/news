// ●Googleスプレッドシート（公開）をCSVで直取り、他と取り方ちがう
// Node 18+ 想定（fetchが使える）
// それ以前なら node-fetch を入れてください

const fs = require('fs');

(async () => {
  try {
    // 元の pubhtml URL
    const pubhtml =
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTzjYx-aE9S3YkL-dTC96PJXBCBqF3we9cE6Kgbv4-CyYolWmuq6BGodxI6vjYez1GjXOLgy5ouM2Ww/pubhtml?gid=0&single=true';

    // pubhtml -> pub にして output=csv を付与
    const csvUrl = pubhtml
      .replace('/pubhtml', '/pub')
      .replace(/[?&]output=[^&]*/g, '') + '&output=csv';

    const res = await fetch(csvUrl, {
      headers: { 'user-agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const csv = await res.text();

    // ●ファイルネーム
    const filename = 'news_google.csv';

    // BOM付きで保存（Excel対策）
    fs.writeFileSync(filename, '\uFEFF' + csv, 'utf8');
    console.log('saved:', filename);
  } catch (err) {
    console.error(`ERROR in news_google: ${err.message}`);
    process.exit(1);
  }
})();
