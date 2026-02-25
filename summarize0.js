const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('news.csv', 'utf8');

  const prompt = `
    入力データ「news.csv」にある文字の羅列から「媒体・分野ごとの区切り（●●〇〇●●）」「記事の見出し」「年月日に関わる情報」のみを抽出する。「●日前」「●時間前」も年月日に関わる情報として残す。
    ノイズデータ（ナビゲーション要素、クリックを誘うボタン、広告、市場データ、記者名、UI要素、もっと見る、など）を削除する。

    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text().replace(/[【】]/g, '');
  fs.writeFileSync('summary0.txt', summaryText);
}

run();
