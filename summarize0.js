const fs = require('fs');

// news.csv を読み、どのサイトでも明らかにゴミと言える行だけを除去して上書きする。
// ●●セクション●●マーカー、記事見出し、時刻（X分前・X時間前・UTC等）は絶対に残す。
// 微妙なものは残す。過剰適応しない。

function main() {
  const raw = fs.readFileSync('news.csv', 'utf8');
  const lines = raw.split('\n');
  const result = [];
  let removed = 0;

  for (const line of lines) {
    // ●●マーカー●● は絶対に残す
    if (/●●.+●●/.test(line)) {
      result.push(line);
      continue;
    }

    // 引用符を外した中身で判定
    const stripped = line.replace(/^\uFEFF/, '').replace(/^"(.*)"$/, '$1').trim();

    if (shouldRemove(stripped, line)) {
      removed++;
      continue;
    }

    result.push(line);
  }

  fs.writeFileSync('news.csv', result.join('\n'));
  console.log(`[summarize0] ${lines.length}行 → ${result.length}行 (${removed}行除去)`);
}

function shouldRemove(s, originalLine) {
  // --- 空行・カンマだけの行 ---
  if (s === '' || /^,+$/.test(s)) return true;

  // --- "category" リテラル（ロイター等のメタデータタグ） ---
  if (s === 'category') return true;

  // --- 株価データ：数字・カンマ・±・%だけの行 ---
  if (/^[+-]?\d[\d,.]*%?$/.test(s)) return true;

  // --- 株価センチメントラベル ---
  if (/^(ポジティブ|ネガティブ|値上がり|値下がり)$/.test(s)) return true;

  // --- バイライン断片（"By" "," "and" ", and" が単独行） ---
  if (/^(By|,|and|, and)$/.test(s)) return true;

  // --- 記者/ライター行（ブルームバーグ・AI関連のクレジット） ---
  if (/^記者[/／]ライター[:：]/.test(s)) return true;

  // --- 写真クレジット（通信社・新聞社の撮影者表記） ---
  if (/\bvia\s+(Reuters|AP|Getty|AFP)\b/i.test(s)) return true;
  if (/\/The New York Times$/.test(s)) return true;
  if (/for (The New York Times|WSJ)$/.test(s)) return true;
  if (/^\|\s*Photographs by\b/.test(s)) return true;

  // --- 読了時間 ---
  if (/^読了\s*\d+\s*分$/.test(s)) return true;
  if (/^\d+\s*MIN READ$/i.test(s)) return true;

  // --- 「もっと見る」系（全サイト共通パターン） ---
  if (/^もっと見る\s*[>›]?\s*$/.test(s)) return true;
  if (/^See more\b/i.test(s)) return true;
  if (/^>>続きを読む/.test(s)) return true;

  // --- 広告ラベル ---
  if (s === 'ADVERTISEMENT') return true;

  // --- ソースタグ単独行（ブルームバーグ/AI関連で見出しの間に挟まる） ---
  if (s === 'Bloomberg.com') return true;

  // --- 2ch 投稿統計（res/h を含む行） ---
  if (/\d+res\/h/.test(s)) return true;

  // --- 2ch 投稿者表記 ---
  if (/^Posted by\s/.test(s)) return true;

  // --- 2ch スレッド統計行（02/25 23:39 822res 142res/h 24.6% □） ---
  if (/^\d{2}\/\d{2}\s+\d{2}:\d{2}\s+\d+res\s/.test(s)) return true;

  // --- URL / ドメイン名のみの行 ---
  if (/^https?:\/\//.test(s)) return true;
  if (/^[\w-]+\.[\w-]+\.\w+$/.test(s) && !s.includes(' ')) return true;

  // --- 数字を含まない短い行（ナビ・メニュー項目） ---
  // 8文字以下が安全圏（Yahoo見出しは9文字～、WSJ"中国の対日貿易戦争"=9文字）
  // 時刻表現（昨日・今日等）は除外
  if (s.length <= 8 && !/\d/.test(s) && !/^(昨日|今日|一昨日)$/.test(s)) return true;

  // --- 記事本文（150文字超）：見出しではなく要約文。CSV形式行は除外 ---
  if (s.length > 150 && !originalLine.includes(',,')) return true;

  return false;
}

main();
