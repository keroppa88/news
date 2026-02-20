const fs = require('fs');

const SOURCES = [
  { fileName: 'news_r_buisiness.csv', title: '●●ロイタービジネス●●' },
  { fileName: 'news_r_keizai.csv', title: '●●ロイター経済●●' },
  { fileName: 'news_r_opinion.csv', title: '●●ロイターオピニオン●●' },
  { fileName: 'news_r_markets.csv', title: '●●ロイター市場●●' },
  { fileName: 'news_b.csv', title: '●●ブルームバーグ●●' },
  { fileName: 'news_bbc.csv', title: '●●BBC●●' },
  { fileName: 'news_google.csv', title: '●●国内etc●●' },
  { fileName: 'news_nytimes.csv', title: '●●NYタイムス●●' },
  { fileName: 'news_wsj.csv', title: '●●WSJ●●' },
  { fileName: 'news_y.csv', title: '●●ヤフー●●' }
];

const OUTPUT_FILE = 'news.csv';

function main() {
  const blocks = [];

  for (const source of SOURCES) {
    if (!fs.existsSync(source.fileName)) {
      console.log(`スキップ: ${source.fileName} が見つかりません。`);
      continue;
    }

    const raw = fs.readFileSync(source.fileName, 'utf8').trim();
    blocks.push(source.title);
    blocks.push(raw);
  }

  if (blocks.length === 0) {
    console.log('結合対象のCSVがありません。');
    return;
  }

  const merged = `\uFEFF${blocks.join('\n\n')}\n`;
  fs.writeFileSync(OUTPUT_FILE, merged, 'utf8');
  console.log(`完了: ${OUTPUT_FILE} を出力しました。`);
}

main();
