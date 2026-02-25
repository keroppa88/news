const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- リトライ（429対策） ---
async function callWithRetry(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e.status === 429 && i < maxRetries - 1) {
        const wait = Math.pow(2, i + 1) * 1000;
        console.log(`Rate limited (429). Retrying in ${wait / 1000}s... (${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw e;
      }
    }
  }
}

// --- 英文検出：日本語がほぼ無く英単語が含まれる行 ---
function needsTranslation(line) {
  if (!line.trim() || line.startsWith('●')) return false;

  // メタ情報を除去（媒体名・日付・番号）
  const cleaned = line
    .replace(/[（(][^)）]*[)）]/g, '')
    .replace(/\d{4}\/\d{2}\/\d{2}/g, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^\*\s*/, '')
    .trim();

  if (cleaned.length < 5) return false;

  // 日本語文字（ひらがな・カタカナ・漢字）が3文字以上あれば日本語見出し
  const japaneseChars = (cleaned.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || []).length;
  if (japaneseChars >= 3) return false;

  // 2文字以上の英単語を抽出
  const asciiWords = cleaned.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/).filter(w => w.length >= 2);
  if (asciiWords.length === 0) return false;
  const avgLen = asciiWords.reduce((s, w) => s + w.length, 0) / asciiWords.length;

  // 日本語ゼロ → 英単語2語以上＋平均語長3超で英文と判定（"Trump Administration" 等）
  if (japaneseChars === 0 && asciiWords.length >= 2 && avgLen > 3) return true;
  // 日本語1-2文字 → 英単語3語以上＋平均語長3超で英文と判定
  if (asciiWords.length >= 3 && avgLen > 3) return true;

  return false;
}

// --- セクション解析（順序保持） ---
function parseOrderedSections(text, markerRegex) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(markerRegex);
    if (m) {
      current = { name: m[1].trim(), header: line, lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
    // セクション開始前の行は無視（summary2ではありえない）
  }
  return sections;
}

// --- 表記フォーマット修正 ---
function fixArticleLine(line) {
  let f = line;

  // 半角カッコ→全角カッコ（媒体名部分）
  f = f.replace(/\(([^)]+)\)(?=\s*\d{4}\/)/g, '（$1）');

  // 日付（yyyy/mm/dd）が媒体カッコより前にある場合→入れ替え
  f = f.replace(
    /(\d{4}\/\d{2}\/\d{2})\s*（([^）]+)）/,
    '（$2）$1'
  );

  // 日付の後ろに「等」が残っている場合→カッコ内に移動
  f = f.replace(
    /（([^）]+)）(\d{4}\/\d{2}\/\d{2})\s*等\s*$/,
    (_, media, date) => `（${media}等）${date}`
  );

  // 日付の後ろに余計な文字がある場合→除去
  f = f.replace(/(\d{4}\/\d{2}\/\d{2})\s+[^\d\s].+$/, '$1');

  // 媒体4社以上→先頭3社＋等に集約
  f = f.replace(/（([^）]+)）/, (match, inner) => {
    const hasEtc = inner.endsWith('等');
    const names = inner.replace(/等$/, '').split('、').map(m => m.trim()).filter(m => m);
    if (names.length > 3) {
      return `（${names.slice(0, 3).join('、')}等）`;
    }
    return match;
  });

  return f;
}

// --- summary2カテゴリー → summary1カテゴリーの対応表 ---
const CAT_MAP = {
  'ロイター': 'ロイター',
  'ブルームバーグ': 'ブルームバーグ',
  'BBC': 'BBC',
  'NYタイムズ': 'NYタイムズ',
  'WSJ': 'WSJ',
  '日経': '日経',
  '時事': '時事',
  'yahoo': 'yahoo',
  'AI関連': 'AI',
  '2ch': '2ch',
};

// --- カテゴリー名 → 記事末尾に付ける媒体タグ名 ---
const CAT_MEDIA_TAG = {
  'ロイター': 'ロイター',
  'ブルームバーグ': 'ブルームバーグ',
  'BBC': 'BBC',
  'NYタイムズ': 'NYタイムズ',
  'WSJ': 'WSJ',
  '日経': '日経',
  '時事': '時事',
  'yahoo': 'yahoo',
  'AI関連': 'AI',
  '2ch': '2ch',
};

// --- 前日の日付を取得（JST基準） ---
function getYesterdayDate() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const y = yesterday.getUTCFullYear();
  const m = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

// --- 記事行に（媒体名）yyyy/mm/dd が欠けていれば補完 ---
function ensureMediaAndDate(line, mediaTag) {
  if (!/^\d+\.\s/.test(line)) return line;

  const hasMedia = /（[^）]+）/.test(line);
  const hasDate = /\d{4}\/\d{2}\/\d{2}/.test(line);

  let result = line.trimEnd();

  if (!hasMedia && !hasDate) {
    // 両方なし → 末尾に追加
    result = result + `（${mediaTag}）${getYesterdayDate()}`;
  } else if (!hasMedia) {
    // 日付はあるが媒体なし → 日付の直前に媒体挿入
    result = result.replace(/(\d{4}\/\d{2}\/\d{2})/, `（${mediaTag}）$1`);
  } else if (!hasDate) {
    // 媒体はあるが日付なし → 媒体の直後に日付追加
    result = result.replace(/(（[^）]+）)\s*$/, `$1${getYesterdayDate()}`);
  }

  return result;
}

// --- 各カテゴリーの最低記事数 ---
const MIN_ARTICLES = {
  '重要ニュース': 10,
  '経済ニュース': 10,
  '国内ニュース': 5,
  '海外ニュース': 5,
  'その他ニュース': 5,
  'ロイター': 5,
  'ブルームバーグ': 5,
  'BBC': 5,
  'NYタイムズ': 5,
  'WSJ': 5,
  '日経': 5,
  '時事': 5,
  'yahoo': 5,
  'AI関連': 5,
  '2ch': 5,
};

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const summary2 = fs.readFileSync('summary2.txt', 'utf8');
  const summary1 = fs.readFileSync('summary1.txt', 'utf8');

  // セクション解析
  const s2Sections = parseOrderedSections(summary2, /^●([^●]+)●$/);
  const s1Sections = parseOrderedSections(summary1, /^●●([^●]+)●●$/);

  // summary1のカテゴリー別記事を辞書化
  const s1Map = {};
  for (const sec of s1Sections) {
    s1Map[sec.name] = sec.lines.filter(l => /^\*\s/.test(l));
  }

  // ===== Step 1: 英文行の検出・翻訳 =====
  const englishEntries = [];
  for (let si = 0; si < s2Sections.length; si++) {
    for (let li = 0; li < s2Sections[si].lines.length; li++) {
      if (needsTranslation(s2Sections[si].lines[li])) {
        englishEntries.push({ si, li, line: s2Sections[si].lines[li] });
      }
    }
  }

  if (englishEntries.length > 0) {
    console.log(`[Step1] ${englishEntries.length}件の英文行を翻訳します...`);
    englishEntries.forEach(e => console.log(`  -> ${e.line.substring(0, 80)}...`));

    const prompt = `以下のニュース見出しを日本語に翻訳してください。
- 各行の番号・（媒体名）・日付はそのまま残し、見出し部分のみ翻訳
- 日本で一般的な固有名詞（AI、BBC、FBI等）は英語のまま可
- 翻訳結果のみを行ごとに出力。説明不要。

${englishEntries.map(e => e.line).join('\n')}`;

    const result = await callWithRetry(() => model.generateContent(prompt));
    const translated = result.response.text().trim().split('\n');

    for (let i = 0; i < englishEntries.length; i++) {
      if (translated[i] && translated[i].trim()) {
        const { si, li } = englishEntries[i];
        s2Sections[si].lines[li] = translated[i].trim();
        console.log(`  翻訳: ${translated[i].trim().substring(0, 60)}...`);
      }
    }
  } else {
    console.log('[Step1] 英文行なし');
  }

  // ===== Step 2: 表記フォーマット修正 =====
  let fixCount = 0;
  for (const sec of s2Sections) {
    for (let i = 0; i < sec.lines.length; i++) {
      if (/^\d+\.\s/.test(sec.lines[i])) {
        const before = sec.lines[i];
        sec.lines[i] = fixArticleLine(sec.lines[i]);
        if (before !== sec.lines[i]) fixCount++;
      }
    }
  }
  console.log(`[Step2] ${fixCount}件の表記を修正`);

  // ===== Step 2.5: 媒体カテゴリーの記事行に（媒体名）年月日が欠けていれば補完 =====
  let mediaFixCount = 0;
  for (const sec of s2Sections) {
    const mediaTag = CAT_MEDIA_TAG[sec.name];
    if (!mediaTag) continue; // コメント・重要ニュース等はスキップ

    for (let i = 0; i < sec.lines.length; i++) {
      if (/^\d+\.\s/.test(sec.lines[i])) {
        const before = sec.lines[i];
        sec.lines[i] = ensureMediaAndDate(sec.lines[i], mediaTag);
        if (before !== sec.lines[i]) {
          console.log(`  補完: ${sec.lines[i].substring(0, 70)}...`);
          mediaFixCount++;
        }
      }
    }
  }
  console.log(`[Step2.5] ${mediaFixCount}件の媒体名・日付を補完`);

  // ===== Step 3: 記事数不足カテゴリーをsummary1から充当 =====
  for (const sec of s2Sections) {
    const minCount = MIN_ARTICLES[sec.name];
    if (!minCount) continue;

    const articleLines = sec.lines.filter(l => /^\d+\.\s/.test(l));
    const currentCount = articleLines.length;
    if (currentCount >= minCount) continue;

    // summary1の対応カテゴリーを探す
    const s1CatName = CAT_MAP[sec.name];
    if (!s1CatName || !s1Map[s1CatName]) {
      if (currentCount < minCount) {
        console.log(`[Step3] ${sec.name}: ${currentCount}/${minCount}件 (summary1に対応カテゴリーなし)`);
      }
      continue;
    }

    const s1Articles = s1Map[s1CatName];
    const needed = minCount - currentCount;

    // 既存記事の見出しを抽出（重複チェック用）
    const existingHeadlines = articleLines.map(l =>
      l.replace(/^\d+\.\s*/, '').replace(/[（(][^)）]*[)）]/g, '').replace(/\d{4}\/\d{2}\/\d{2}/g, '').trim()
    );

    // 末尾の空行を一旦除去
    while (sec.lines.length > 0 && sec.lines[sec.lines.length - 1].trim() === '') {
      sec.lines.pop();
    }

    let added = 0;
    for (const s1Art of s1Articles) {
      if (added >= needed) break;

      // 途中で切れている行はスキップ
      if (!/\d{4}\/\d{2}\/\d{2}/.test(s1Art)) continue;

      const s1Headline = s1Art
        .replace(/^\*\s*/, '')
        .replace(/[（(][^)）]*[)）]/g, '')
        .replace(/\d{4}\/\d{2}\/\d{2}/g, '')
        .trim();

      // 重複チェック
      const isDup = existingHeadlines.some(h =>
        h === s1Headline || h.includes(s1Headline) || s1Headline.includes(h)
      );
      if (isDup) continue;

      const num = currentCount + added + 1;
      let formatted = s1Art
        .replace(/^\*\s*/, `${num}. `)
        .replace(/\(/g, '（')
        .replace(/\)/g, '）');
      formatted = fixArticleLine(formatted);

      sec.lines.push(formatted);
      existingHeadlines.push(s1Headline);
      added++;
    }

    if (added > 0) {
      console.log(`[Step3] ${sec.name}: ${currentCount}→${currentCount + added}件 (+${added} from summary1)`);
    } else if (currentCount < minCount) {
      console.log(`[Step3] ${sec.name}: ${currentCount}/${minCount}件 (summary1にも追加候補なし)`);
    }
  }

  // ===== 再構築・保存 =====
  const output = s2Sections.map(sec => {
    const body = sec.lines.join('\n').trimEnd();
    return sec.header + '\n' + body;
  }).join('\n\n').replace(/[【】]/g, '');

  fs.writeFileSync('summary2.txt', output);

  // warehouse保存
  const warehouseDir = path.join(__dirname, 'warehouse');
  if (!fs.existsSync(warehouseDir)) fs.mkdirSync(warehouseDir, { recursive: true });
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const ts = now.getUTCFullYear().toString()
    + String(now.getUTCMonth() + 1).padStart(2, '0')
    + String(now.getUTCDate()).padStart(2, '0')
    + String(now.getUTCHours()).padStart(2, '0')
    + String(now.getUTCMinutes()).padStart(2, '0');
  fs.writeFileSync(path.join(warehouseDir, `${ts}.text`), output);

  console.log('[完了] summary2.txt を更新しました');
}

run();
