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

const { normalize, validate, needsTranslation } = require('./news-quality');

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
  'AXIOS': 'AXIOS',
  '日経': '日経',
  '時事': '時事',
  '日経・読売・産経・47・みんかぶ': '日経・読売・産経・47・みんかぶ',
  '日経・読売、テクノロジー': '日経・読売、テクノロジー',
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
  'AXIOS': 'AXIOS',
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

// --- 掲載してよい最古の日付（日本時間の前日）yyyy/mm/dd ---
function oldestAllowedDate() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
}

// --- 古い日付・見出しが空の記事行か ---
// Geminiは取得できなかった媒体の欄に、指示文の例や古い記事を作ってしまうことがある
function isStaleOrEmpty(line, oldest) {
  const m = line.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s*$/);
  if (m) {
    const date = `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
    if (date < oldest) return true;
  }
  const headline = line
    .replace(/^(\d+\.|\*)\s*/, '')
    .replace(/[（(][^)）]*[)）]/g, '')
    .replace(/\d{4}\/\d{1,2}\/\d{1,2}/g, '')
    .trim();
  return headline.length < 4;
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
  'AXIOS': 5,
  '日経': 5,
  '時事': 5,
  '日経・読売・産経・47・みんかぶ': 10,
  '日経・読売、テクノロジー': 3,
  'yahoo': 5,
  'AI関連': 5,
  '2ch': 5,
};

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const summary2 = fs.readFileSync('summary2.txt', 'utf8');
  const summary1 = fs.readFileSync('summary1.txt', 'utf8');

  // セクション解析
  const s2Sections = parseOrderedSections(normalize(summary2), /^●([^●]+)●$/);
  // summary1の見出しは「●●ロイター●●」「### ロイター」「### ●●ロイター●●」などGeminiによって表記が揺れる
  const s1Sections = parseOrderedSections(summary1, /^(?:#{1,6}\s*(?:\*\*)?(?:●●)?|(?:\*\*)?●●)([^●*]+?)(?:●●)?(?:\*\*)?\s*$/);

  // 欄名の表記揺れ（Yahoo!／yahoo、AI関連／AI など）をそろえる
  const norm = s => s.replace(/[!！\s]/g, '').toLowerCase();
  for (const sec of s2Sections) {
    const key = Object.keys(MIN_ARTICLES).find(k => norm(k) === norm(sec.name));
    if (key && key !== sec.name) { sec.name = key; sec.header = `●${key}●`; }
  }

  // summary1のカテゴリー別記事を辞書化
  const s1Map = {};
  for (const sec of s1Sections) {
    s1Map[sec.name] = sec.lines.filter(l => /^\*\s/.test(l));
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

  // ===== Step 2.7: 古い日付・見出しが空の記事を削除して番号を振り直す =====
  const oldest = oldestAllowedDate();
  let staleCount = 0;
  for (const sec of s2Sections) {
    const before = sec.lines.length;
    sec.lines = sec.lines.filter(l => !(/^\d+\.\s/.test(l) && isStaleOrEmpty(l, oldest)));
    staleCount += before - sec.lines.length;
    let n = 0;
    sec.lines = sec.lines.map(l => /^\d+\.\s/.test(l) ? l.replace(/^\d+\./, `${++n}.`) : l);
  }
  for (const name of Object.keys(s1Map)) {
    s1Map[name] = s1Map[name].filter(l => !isStaleOrEmpty(l, oldest));
  }
  console.log(`[Step2.7] ${oldest}より古い・見出しが空の記事を${staleCount}件削除`);

  // ===== Step 2.8: Geminiが省いた媒体の欄を作り直す（Step 3でsummary1から記事を補充） =====
  const order = Object.keys(MIN_ARTICLES);
  for (const name of order) {
    if (!CAT_MAP[name] || s2Sections.some(sec => sec.name === name)) continue;
    // 決められた並び順で直前にある欄の後ろに入れる
    let at = s2Sections.length;
    for (let k = order.indexOf(name) - 1; k >= 0; k--) {
      const prev = s2Sections.findIndex(sec => sec.name === order[k]);
      if (prev >= 0) { at = prev + 1; break; }
    }
    s2Sections.splice(at, 0, { name, header: `●${name}●`, lines: [], added: true });
    console.log(`[Step2.8] 欠けていた欄を追加: ${name}`);
  }

  // ===== Step 3: 記事数不足カテゴリーをsummary1から充当 =====
  for (const sec of s2Sections) {
    const minCount = MIN_ARTICLES[sec.name];
    if (!minCount) continue;

    const articleLines = sec.lines.filter(l => /^\d+\.\s/.test(l));
    const currentCount = articleLines.length;
    if (currentCount >= minCount) continue;

    // summary1の対応カテゴリーを探す
    const s1CatName = CAT_MAP[sec.name] && Object.keys(s1Map).find(k =>
      norm(k) === norm(CAT_MAP[sec.name]) || norm(k) === norm(sec.name));
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

  // Translate after supplementation; map IDs instead of relying on line order.
  const entries = [];
  for (const sec of s2Sections) for (let i = 0; i < sec.lines.length; i++) {
    const line = sec.lines[i];
    if (!/^\d+\.\s/.test(line) || !needsTranslation(line)) continue;
    const match = line.match(/^(\d+\.\s*)(.*?)([（(][^）)]*[）)]\s*\d{4}\/\d{2}\/\d{2}\s*)$/);
    if (!match) throw new Error('English headline has invalid metadata');
    entries.push({ sec, i, prefix: match[1], headline: match[2], suffix: match[3] });
  }
  if (entries.length) {
    console.log(`Translating ${entries.length} headlines after supplementation`);
    let translated;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = 'ニュース見出しを日本語に翻訳。事実を追加せず、固有名詞は通常の日本語表記。入力の全idを一度ずつ含むJSON配列だけを返す。形式 [{"id":0,"headline":"日本語見出し"}]。\n' + JSON.stringify(entries.map((e, id) => ({ id, headline: e.headline })));
      const result = await callWithRetry(() => model.generateContent(prompt));
      try {
        const rows = JSON.parse(result.response.text().replace(/```(?:json)?/g, '').trim());
        if (!Array.isArray(rows) || rows.length !== entries.length) throw new Error('Translation count mismatch');
        const ids = new Set();
        for (const row of rows) {
          if (!Number.isInteger(row.id) || row.id < 0 || row.id >= entries.length || ids.has(row.id) || typeof row.headline !== 'string' || !/[\u3040-\u30ff\u4e00-\u9fff]/.test(row.headline) || needsTranslation(row.headline) || /[\r\n]/.test(row.headline)) throw new Error('Invalid translation');
          ids.add(row.id);
        }
        translated = rows; break;
      } catch (error) { if (attempt === 2) throw error; }
    }
    for (const row of translated) {
      const entry = entries[row.id];
      entry.sec.lines[entry.i] = entry.prefix + row.headline.trim() + entry.suffix;
    }
  }

  // ===== 再構築・保存 =====
  const output = s2Sections.filter(sec => !(sec.added && !sec.lines.some(l => /^\d+\.\s/.test(l)))).map(sec => {
    const body = sec.lines.join('\n').trimEnd();
    return sec.header + '\n' + body;
  }).join('\n\n').replace(/[【】]/g, '');

  validate(output);
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

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });


module.exports = { run };
