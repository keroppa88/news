const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0,
      topP: 0,
      maxOutputTokens: 8192,
    },
  });
  const csvData = fs.readFileSync('news.csv', 'utf8');

  const prompt = `
    あなたの仕事は「news.csvのノイズ除去だけ」です。
    要約・説明・コード生成はしないでください。

    以下のルールで、ノイズを削除した結果だけを返してください。
    - 残す: 媒体・分野の区切り（例: ●●ロイター●●）、記事見出し、日時情報（例: 6時間前, 2026年2月25日, 午後 3:10 UTC）。
    - 削除: ナビゲーション要素、UIラベル、広告、銘柄や指数の数値ボード、記者プロフィール、SNS誘導、"もっと見る" 等のサイト部品。
    - 出力形式: プレーンテキストのみ。
    - 禁止: Markdown記法、コードブロック、解説文、前置き、後書き。
    - 区切りや改行は入力の構造をできるだけ維持する。

    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text().replace(/[【】]/g, '');
  fs.writeFileSync('summary0.txt', summaryText);
}

run();
