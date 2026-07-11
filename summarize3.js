const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MIN_KEYWORDS = 60;
const MAX_KEYWORDS = 100;
const MAX_RETRIES = 3;

// ●AI●（AI専門メディア）セクションを入力から除去する。
// AIニュースだらけでワードクラウドが埋まるのを防ぐ。他セクションのAI記事は集計対象のまま。
// ヘッダー表記ゆれ（●AI関連●、**●●AI●●**、### ●●AI関連●● 等）に対応
function stripAiSection(text) {
  const headerRe = /^(?:#+\s*)?\*{0,2}●+\s*(.+?)\s*●+\*{0,2}\s*$/;
  const out = [];
  let skipping = false;
  for (const line of text.split('\n')) {
    const m = line.trim().match(headerRe);
    if (m) {
      const name = m[1].trim();
      skipping = (name === 'AI' || name === 'AI関連');
    }
    if (!skipping) out.push(line);
  }
  return out.join('\n');
}

// 類似キーワードの集約グループを決める語幹。
// 先頭の英数字語（AI、FRB、EU等）、なければ先頭2文字（イラン→イラ、トランプ→トラ）
function stemOf(word) {
  const ascii = word.match(/^[A-Za-z0-9&．.]+/);
  if (ascii) return ascii[0].toUpperCase();
  return word.slice(0, 2);
}

const MAX_PER_STEM = 4; // 同じ語幹のキーワードは上位4個まで

// 類似キーワードを集約する。
// 1) 片方がもう片方を含む場合（AIチップ⊂AIチップメーカー等）は高スコア側に統合
// 2) 同じ語幹（AI○○等）はスコア上位4個までに制限し、派生語の羅列が上位を占めるのを防ぐ
function aggregate(entries) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);

  // 包含関係の統合: スコア順に見て、採用済み語と包含関係にあれば捨てる。
  // ただし短い側が4文字未満（AI、円等）の場合は別トピックとみなして統合しない
  const merged = [];
  for (const e of sorted) {
    const dup = merged.some(m => {
      const shorter = m.word.length <= e.word.length ? m.word : e.word;
      const longer = m.word.length <= e.word.length ? e.word : m.word;
      return shorter.length >= 4 && longer.includes(shorter);
    });
    if (!dup) merged.push(e);
  }

  // 語幹ごとの上限
  const stemCount = {};
  const result = [];
  for (const e of merged) {
    const stem = stemOf(e.word);
    stemCount[stem] = (stemCount[stem] || 0) + 1;
    if (stemCount[stem] <= MAX_PER_STEM) result.push(e);
  }
  return result;
}

// 出力を検証・洗浄する。壊れた行や暴走の繰り返しを落とし、有効な「キーワード\tスコア」だけ返す
function sanitize(raw) {
  const lines = raw
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .split('\n');

  const seen = new Set();
  const entries = [];
  for (const line of lines) {
    const parts = line.trim().split('\t');
    if (parts.length !== 2) continue;
    const word = parts[0].trim();
    const score = parseInt(parts[1].trim(), 10);
    if (!word || word.length > 20) continue;          // 長文はキーワードではない
    if (!Number.isInteger(score) || score < 1 || score > 100) continue;
    if (/[（）()「」。、]/.test(word)) continue;       // 文章の混入を除外
    if (seen.has(word)) continue;                      // 反復ループ暴走を無効化
    seen.add(word);
    entries.push({ word, score });
    if (entries.length >= MAX_KEYWORDS) break;
  }
  return aggregate(entries);
}

async function generate(model, csvData) {
  const prompt = `
    あなたはニュース分析の専門家です。以下のニュースリストを分析して、ワードクラウド用のキーワードと重要度スコアを抽出してください。

    ## ルール
    1. ニュース全体を俯瞰し、重要なキーワード・トピックを60〜80個抽出する。80個を超えてはならない。
    2. 各キーワードに重要度スコア（1〜100の整数）を付与する。スコアの基準：
       - 複数媒体が報じている話題ほど高スコア（最大100）
       - トップニュースや見出しに繰り返し登場するキーワードは高スコア
       - 単一媒体のみの話題は低スコア（10〜30程度）
       - 0以下やマイナスのスコアは禁止。
    3. キーワードは意味のあるまとまりで抽出する（複合語を推奨）。1キーワードは20文字以内。
       - 良い例: 「トランプ関税」「ビッグマック値上げ」「中国輸出禁止」「ウクライナ侵攻」
       - 悪い例: 「トランプ」「関税」を別々に抽出（意味が曖昧になる）
       - ただし、人名・企業名・国名など単独で意味が明確なものはそのまま可（例: 「アンソロピック」「メキシコ」）
    4. 同じキーワードを2回以上出力してはならない。表記ゆれ（「AIロボ」と「AIロボット」等）や、同じ語幹に接尾語だけ変えた派生語の羅列も禁止。1トピックにつき代表的な1語のみ。
    5. ニュースリストに存在しない話題を創作してはならない。必ずリスト中の記事に対応するキーワードのみ抽出する。
    6. 媒体名（ロイター、BBC、ブルームバーグ、NYタイムズ、WSJ、日本経済新聞、Reuters、PR TIMES、ITmedia NEWS等）はキーワードに含めない。
    7. 日付、記号、セクション見出しはキーワードに含めない。
    8. 日本語キーワードを主体とするが、固有名詞の英語表記（IBM、COBOL、AI、MLB等）はそのまま使用可。
    9. 「ニュース」「報道」「発表」「高騰」「低下」「リスク」「期待感」など、単独では話題を特定できない一般語は除外する。
    10. スポーツ選手名、企業名、政策名など具体的な固有名詞を積極的に含める。
    11. 低スコアのワードはなるべく短文もしくは単語で提示する。（ワードクラウド図に多くを収録提示するため）。
    12. 最低でも60個のワードを必ず提示する。重要ニュースだけでなく、経済・国内・海外・その他の各セクションからまんべんなく拾うこと。

    ## 出力形式
    タブ区切りで「キーワード（タブ）スコア」を1行ずつ出力する。
    スコアの高い順に並べる。
    ヘッダー行や説明文は一切不要。データのみ出力すること。
    全キーワードを出力し終えたら、そこで必ず出力を終了する。

    出力例:
    トランプ関税\t100
    中国輸出禁止\t90
    ビッグマック値上げ\t85
    アンソロピック\t75
    ウクライナ侵攻\t70

    ## ニュースリスト:
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function run() {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.4,      // 反復暴走・形式崩れの抑制
      maxOutputTokens: 4096, // 60〜80行のTSVには十分。暴走時の課金上限を兼ねる
    },
  });
  const csvData = stripAiSection(fs.readFileSync('summary15.txt', 'utf8'));

  let entries = [];
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const raw = await generate(model, csvData);
    entries = sanitize(raw);
    console.log(`attempt ${attempt}: ${entries.length} valid keywords`);
    if (entries.length >= MIN_KEYWORDS) break;
    if (attempt < MAX_RETRIES) console.log('  -> below minimum, retrying...');
  }
  if (entries.length === 0) {
    throw new Error('No valid keywords extracted after retries');
  }

  const cleaned = entries.map(e => `${e.word}\t${e.score}`).join('\n');

  fs.writeFileSync('summary3.txt', cleaned);

  // Archive to warehouse with date-based filename (e.g. 20260410weight.txt)
  const today = new Date();
  const dateStr = today.getFullYear().toString()
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  const warehousePath = path.join('warehouse', `${dateStr}weight.txt`);
  fs.mkdirSync('warehouse', { recursive: true });
  fs.writeFileSync(warehousePath, cleaned);
  console.log(`Archived to ${warehousePath}`);

  console.log(`summary3.txt generated: ${entries.length} keywords`);
  console.log('Top 10:');
  entries.slice(0, 10).forEach(e => console.log(`  ${e.word}\t${e.score}`));
}

if (require.main === module) run();

module.exports = { stripAiSection, sanitize, aggregate };
