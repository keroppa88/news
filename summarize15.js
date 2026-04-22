const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const csvData = fs.readFileSync('summary1.txt', 'utf8');

  const prompt = `
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
      
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text().replace(/[【】]/g, '');
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

run();
