const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('news.csv', 'utf8');

  const prompt = `
    文字の羅列から記事の見出しを抽出して羅列する。
    年月日と媒体名を付与する。
    英語は日本語に翻訳する。
    例
    「見出し」(ロイター)2025/06/01
  
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text();
  fs.writeFileSync('summary1.txt', summaryText);
)
run();
