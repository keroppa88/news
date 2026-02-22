const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('news.csv', 'utf8');

  const prompt = `
    news.csvを読んで文字の羅列から記事の見出しを抽出して羅列する。
    ﻿●●ロイタービジネス●●
    ●●ロイター経済●●
    ●●ロイターオピニオン●●
    ●●ロイター市場●●
    ●●ブルームバーグ●●
    ●●BBC●●
    ●●国内etc●●
    ●●NYタイムズ●●
    ●●WSJ●●
    ●●ヤフー●●
    ●●AI関連●●
    上記のように媒体、分野ごとに並んでいるので、この区分けを維持したまま、
    不要な文言、メニュー文字などを削除して記事見出しを抽出する。
    記事見出しには媒体名と年月日を付与すること。
    英語は日本語に翻訳する。
    例
    「見出し」(ロイター)2025/06/01
  
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text();
  fs.writeFileSync('summary1.txt', summaryText);
}

run();
