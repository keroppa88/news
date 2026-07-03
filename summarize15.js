const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MAX_ATTEMPTS = 2;

function buildPrompt(csvData, strict) {
  const strictNote = strict ? `
    # 厳守事項（前回の出力は不合格だった。以下を必ず守ること）
    * 修正後の完成リストだけを出力する。
    * 「原文:」「修正:」のような比較・レポート形式は禁止。
    * 見出しや締めの挨拶文（「以上で〜完了しました」等）は禁止。
    * 英文見出しを残すことは禁止。全て日本語に翻訳する。
  ` : '';
  return `
    # テキストは全て日本語でなければならない。そのためのチェックと修正を行う。
    1. ### ●●BBC●●　に属するニュース見出しをチェックする。
      * 日本語に翻訳されている場合は合格。
        * そのままスルー。
      * 英文記事見出しが羅列されている場合は不合格。
        * それら全てを日本語の記事見出しに翻訳して置き換える。
    2、### ●●NYタイムズ●● に属するニュース見出しをチェックする。
      * 日本語に翻訳されている場合は合格。
        * そのままスルー。
      * 英文記事見出しが羅列されている場合は不合格。
        * それら全てを日本語の記事見出しに翻訳して置き換える。
    3、各媒体の記事見出しを最終チェックする。英文記事見出しが存在する場合は、それらを日本語の記事見出しに翻訳して置き換える。

    # 出力形式
    * 修正を反映した完成後のリスト全体のみを出力する。
    * チェック過程の説明、原文と修正の併記、前置きや締めの文章は一切出力しない。
    ${strictNote}
    リスト：
    ${csvData}
  `;
}

// 英文のまま残っている見出し行の割合を返す
function englishRatio(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 15);
  if (lines.length === 0) return 0;
  const en = lines.filter(l => {
    const chars = l.replace(/\s/g, '');
    const ascii = (chars.match(/[A-Za-z]/g) || []).length;
    return ascii / chars.length > 0.6;
  });
  return en.length / lines.length;
}

// 出力の健全性チェック。問題なければ null、あれば理由を返す
function validate(output, input) {
  if (output.length > input.length * 1.5) return 'bloated';       // 原文併記レポート化
  if (output.length < input.length * 0.4) return 'truncated';     // 途中で切れた
  if (englishRatio(output) > 0.3) return 'untranslated';          // 英文のまま
  if (/\*\*原文|^#+ /m.test(output)) return 'report-format';      // レポート形式の混入
  return null;
}

// レポート形式化した出力から完成リストを機械的に救出する（AI再実行なし）
function repair(output) {
  let text = output;
  // 「最終的なリスト:」以降に完成品があるパターン
  const m = text.match(/\*\*最終(的な)?リスト[:：]?\*\*/);
  if (m) text = text.slice(m.index + m[0].length);
  // マークダウン装飾と説明行を除去
  text = text
    .split('\n')
    .filter(l => !/^#+ /.test(l.trim()))                 // 「## チェックと修正」等の見出し
    .filter(l => !/^\*\*(原文|修正)/.test(l.trim()))     // 比較用ラベル
    .filter(l => !/^\*\*以上で/.test(l.trim()))          // 締めの挨拶
    .filter(l => !/^（.*）$/.test(l.trim()))             // 「（〜をここに記載）」等の注釈
    .map(l => l.replace(/^\*\*(.+)\*\*$/, '$1'))         // **●●ロイター●●** → ●●ロイター●●
    .join('\n')
    .trim();
  return text;
}

async function generate(temperature, csvData, strict) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { temperature },
  });
  const result = await model.generateContent(buildPrompt(csvData, strict));
  return result.response.text().replace(/[【】]/g, '');
}

async function run() {
  const csvData = fs.readFileSync('summary1.txt', 'utf8');

  let summaryText = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 2回目は temperature を上げ、失敗モードを名指しで禁止した厳格プロンプトに切り替える
    // （同条件の再実行では同じ失敗を引き直す恐れがあるため）
    const candidate = await generate(attempt === 1 ? 0.3 : 0.7, csvData, attempt > 1);
    let reason = validate(candidate, csvData);
    if (!reason) { summaryText = candidate; break; }
    console.log(`attempt ${attempt}: NG (${reason}), trying mechanical repair...`);

    const repaired = repair(candidate);
    reason = validate(repaired, csvData);
    if (!reason) { summaryText = repaired; console.log('  -> repaired'); break; }
    console.log(`  -> repair failed (${reason})`);
  }

  if (summaryText === null) {
    // 最終フォールバック: 壊れた出力を下流に流すより、一部英文が残る入力をそのまま使う
    console.log('WARNING: all attempts failed, falling back to summary1.txt as-is');
    summaryText = csvData;
  }

  fs.writeFileSync('summary15.txt', summaryText);

  // warehouse フォルダに年月日時刻のファイル名で保存
  const warehouseDir = path.join(__dirname, 'warehouse');
  if (!fs.existsSync(warehouseDir)) fs.mkdirSync(warehouseDir, { recursive: true });
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const ts = now.getUTCFullYear().toString()
    + String(now.getUTCMonth() + 1).padStart(2, '0')
    + String(now.getUTCDate()).padStart(2, '0')
    + String(now.getUTCHours()).padStart(2, '0')
    + String(now.getUTCMinutes()).padStart(2, '0');
  fs.writeFileSync(path.join(warehouseDir, `${ts}.text`), summaryText);
}

if (require.main === module) run();

module.exports = { validate, repair, englishRatio };
