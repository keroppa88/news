const fs = require('fs');

const SOURCES = [
  { fileName: 'news_r.csv', title: '●●ロイター●●' },
  { fileName: 'news_r_keizai.csv', title: '●●ロイター経済●●' },
  { fileName: 'news_r_markets.csv', title: '●●ロイター市場●●' },
  { fileName: 'news_b.csv', title: '●●ブルームバーグ●●' },
  { fileName: 'news_bbc.csv', title: '●●BBC●●' },
  { fileName: 'news_google.csv', title: '●●国内etc●●', split: ['日経', '時事'] },
  { fileName: 'news_jp.csv', title: '●●日経・読売・産経・47・みんかぶ●●' },
  { fileName: 'news_jp_tech.csv', title: '●●日経・読売、テクノロジー●●' },
  { fileName: 'news_nytimes.csv', title: '●●NYタイムズ●●' },
  { fileName: 'news_wsj.csv', title: '●●WSJ●●' },
  { fileName: 'news_axios.csv', title: '●●AXIOS●●' },
  { fileName: 'news_y.csv', title: '●●ヤフー●●' },
  { fileName: 'news_ai.csv', title: '●●AI関連●●' },
  { fileName: 'news_2ch.csv', title: '●●2ch●●' }
];

const OUTPUT_FILE = 'news.csv';

// CSVの1行をセルに分ける（"..." で囲まれたカンマや "" に対応）
function parseCsvLine(line) {
  const cells = [];
  let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

// 「,日経1,見出し,時事1,見出し」の行から、指定した名札の見出しを取り出す
function splitLabeled(raw, names) {
  const sections = Object.fromEntries(names.map((name) => [name, []]));
  const rest = raw.split(/\r?\n/).map((line) => {
    const cells = parseCsvLine(line.replace(/^\uFEFF/, ''));
    let changed = false;
    for (let i = 0; i < cells.length - 1; i++) {
      const m = cells[i].trim().match(/^(.+?)\d+$/);
      if (m && sections[m[1]] && cells[i + 1].trim()) {
        sections[m[1]].push(`"${cells[i + 1].trim().replace(/"/g, '""')}"`);
        cells[i] = '';
        cells[i + 1] = '';
        changed = true;
      }
    }
    if (!changed) return line; // 名札のない行（複数行にまたがるセルを含む）はそのまま
    return cells.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',');
  });
  return { sections, rest: rest.join('\n') };
}

function main() {
  const blocks = [];

  for (const source of SOURCES) {
    if (!fs.existsSync(source.fileName)) {
      console.log(`スキップ: ${source.fileName} が見つかりません。`);
      continue;
    }

    const raw = fs.readFileSync(source.fileName, 'utf8').trim().replace(/[【】]/g, '');
    if (source.split) {
      // 「日経1,見出し」のような名札付きの見出しを媒体ごとの欄に分ける（Geminiに任せると欄が消えることがある）
      const { sections, rest } = splitLabeled(raw, source.split);
      for (const name of source.split) {
        blocks.push(`●●${name}●●`);
        blocks.push(sections[name].join('\n'));
      }
      blocks.push(source.title);
      blocks.push(rest);
      continue;
    }
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
