const fs = require('fs');
const path = require('path');

// 設定：ファイル名と日本語ラベルの対応マップ
const FILE_MAP = {
  'news_r_buisiness.csv': 'ロイタービジネス',
  'news_b.csv': 'ブルームバーグ',
  'news_r_keizai.csv': 'ロイター経済',
  'news_r_opinion.csv': 'ロイターオピニオン',
  'news_r_markets.csv': 'ロイター市場',
  'news_bbc.csv': 'BBC',
  'news_google.csv': '国内etc',
  'news_nytimes.csv': 'NYタイムス',
  'news_wsj.csv': 'WSJ',
  'news_y.csv': 'ヤフー'
};

// ヤフーニュースの詳細カテゴリ名
const YAHOO_CAT_MAP = {
  '国内': 'ヤフー国内',
  '国際': 'ヤフー国際',
  '経済': 'ヤフー経済',
  'エンタメ': 'ヤフーエンタメ',
  'スポーツ': 'ヤフースポーツ',
  'IT': 'ヤフーIT',
  '科学': 'ヤフー科学'
};

const OUTPUT_FILE = 'news.csv';

/**
 * 日本語の日付文字列をDateオブジェクトに変換する
 * @param {string} infoStr - "2026年1月17日 ロイタービジネス" のような形式
 */
function parseDateFromInfo(infoStr) {
  const match = infoStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return null; // 日付がない場合（ヤフー等）
}

/**
 * ロイター形式の抽出（2カラム化：見出し, 日付＋ラベル）
 */
function extractFromReuters(lines, label) {
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'category') {
      let headline = "";
      let dateRaw = "";
      const nextLine = lines[i + 1] || "";

      if (nextLine.startsWith('·') || nextLine.includes('GMT')) {
        dateRaw = nextLine;
        headline = lines[i - 2] || ""; 
      } else {
        headline = nextLine;
        dateRaw = lines[i + 2] || "";
      }

      const dateMatch = dateRaw.match(/\d{4}年\d{1,2}月\d{1,2}日/);
      const cleanDate = dateMatch ? dateMatch[0] : dateRaw;

      if (headline && !headline.includes('値上がり') && !headline.includes('値下がり') && headline.length > 5) {
        results.push({ headline, info: `${cleanDate} ${label}`.trim() });
      }
    }
  }
  return results;
}

/**
 * ブルームバーグ形式の抽出（2カラム化：見出し, 日付＋ラベル）
 */
function extractFromBloomberg(lines, label) {
  const results = [];
  const startIdx = lines.indexOf('最新ニュース');
  const endIdx = lines.findIndex(l => l.includes('さらに表示する'));
  if (startIdx === -1) return [];

  const targetLines = lines.slice(startIdx + 1, endIdx !== -1 ? endIdx : lines.length);
  for (let i = 0; i < targetLines.length; i++) {
    const line = targetLines[i];
    const isDate = /\d+ (時間|分)前|\d{4}年\d{1,2}月\d{1,2}日/.test(line);
    if (isDate) {
      const dateMatch = line.match(/\d{4}年\d{1,2}月\d{1,2}日/);
      const cleanDate = dateMatch ? dateMatch[0] : line;
      const next = targetLines[i + 1] || "";
      const prev = targetLines[i - 1] || "";
      let headline = "";
      if (next.length > 10 && !/\d+ (時間|分)前|\d{4}年\d{1,2}月\d{1,2}日/.test(next) && !next.includes('Opinion')) {
        headline = next;
        i++; 
      } else if (prev.length > 10 && !/\d+ (時間|分)前|\d{4}年\d{1,2}月\d{1,2}日/.test(prev) && !prev.includes('Opinion')) {
        if (results.length === 0 || results[results.length - 1].headline !== prev) {
          headline = prev;
        }
      }
      if (headline && headline.length > 5) {
        results.push({ headline, info: `${cleanDate} ${label}`.trim() });
      }
    }
  }
  return results;
}

/**
 * ヤフー形式の抽出
 */
function extractFromYahoo(lines) {
  const results = [];
  const targetCats = Object.keys(YAHOO_CAT_MAP);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (targetCats.includes(line)) {
      const nextLine = lines[i + 1] || "";
      if (nextLine && !targetCats.includes(nextLine) && nextLine !== 'ライフ' && nextLine !== '地域') {
        const catLabel = YAHOO_CAT_MAP[line];
        for (let j = 1; j <= 8; j++) {
          const headline = lines[i + j];
          if (headline && headline.length > 2 && headline !== 'もっと見る') {
            results.push({
              headline: headline,
              info: catLabel // 日付が含まれないため、フィルタリング対象外（常に保持）
            });
          }
        }
        i += 8;
      }
    }
  }
  return results;
}

function main() {
  let allExtractedData = [];

  for (const [fileName, label] of Object.entries(FILE_MAP)) {
    if (!fs.existsSync(fileName)) continue;

    console.log(`処理中: ${fileName}...`);
    const rawData = fs.readFileSync(fileName, 'utf8');
    const lines = rawData.split(/\r?\n/).map(line => line.replace(/^"|"$/g, '').trim());
    
    let fileData = [];
    if (fileName === 'news_b.csv') {
      fileData = extractFromBloomberg(lines, label);
    } else if (fileName === 'news_y.csv') {
      fileData = extractFromYahoo(lines);
    } else {
      fileData = extractFromReuters(lines, label);
    }
    
    allExtractedData = allExtractedData.concat(fileData);
  }

  // --- 日付によるフィルタリング追加 ---
  const now = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(now.getDate() - 3);
  thresholdDate.setHours(0, 0, 0, 0); // 3日前の0時0分0秒に設定

  const filteredData = allExtractedData.filter(item => {
    const itemDate = parseDateFromInfo(item.info);
    // 日付情報がない場合（ヤフー等）は、最新とみなして残す
    if (!itemDate) return true;
    // 3日前（0時）以降のデータのみ保持
    return itemDate >= thresholdDate;
  });
  // ---------------------------------

  if (filteredData.length === 0) {
    console.log("フィルタリング後のニュースが0件です。");
    return;
  }

  let csvContent = '\uFEFF"見出し","情報"\n';
  filteredData.forEach(item => {
    const h = item.headline.replace(/"/g, '""');
    const i = item.info.replace(/"/g, '""');
    csvContent += `"${h}","${i}"\n`;
  });

  fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf8');
  console.log(`完了: ${filteredData.length} 件（全 ${allExtractedData.length} 件中）を ${OUTPUT_FILE} に保存しました。`);
}

main();

