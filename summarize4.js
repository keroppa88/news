const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('summary2.txt', 'utf8');

  const prompt = `
    ニュースまとめ情報を最終チェックします。要件は1点のみです。それ以外のことはしないように。
    1、入力文書はニュース見出し、媒体、時系列をカテゴリー別に分けたもの。●BBC●、●NYタイムズ●　この二つのカテゴリーには英文が混じっている可能性がある。これを解決する。
    2，この二つのカテゴリーにある英文は日本語訳にする。英文はある場合は前工程での処理ミスなので、必ずこの工程で翻訳処理をする。日本で一般的な固有名詞は英語のままでよい。
    3，以上。英文が混じっている場合に日本語訳にする。これ以外のことは一切やってはならない。
  
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text().replace(/[【】]/g, '');
  fs.writeFileSync('summary2.txt', summaryText);

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

run();
