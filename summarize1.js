const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('news.csv', 'utf8');

  const today = new Date().toISOString().split('T')[0]; // UTC基準の当日日付

  const prompt = `
    当日の日付は${today}（UTC基準）です。
    news.csvを読んで文字の羅列から記事の見出しを抽出して羅列する。英語は日本語に翻訳する。
    手順1、文字の羅列から「媒体・分野ごとの区切り」、「記事の見出し」と「年月日に関わる情報」のみを抽出する。これをAとする。
    手順2、Aのにある記事見出し情報を「記事の見出し」＋「媒体・分野」＋「年月日」の形で1行ごとにまとめる。
       例　「見出し」(ロイター)2025/06/01
    手順3、「〇日前」という曖昧な時系列情報は現在の日付から年月日を推測する。
    手順4、当日より3日以上前の記事見出しは削除する。
    手順5、「〇時間前」の記事は当日の記事として扱う。
    手順6、「記事の見出し」＋「媒体・分野」＋「年月日」の形にまとめられない不明瞭な情報は削除する。
    手順7、下記に示した●●で囲まれた媒体、分野ごとに記事を並べる。勝手な省略や削除は厳禁。
    ﻿●●ロイタービジネス●●　日本時間（UTC+9）
    ●●ロイター経済●●　日本時間（UTC+9）
    ●●ロイターオピニオン●●　日本時間（UTC+9）
    ●●ロイター市場●●　日本時間（UTC+9）
    ●●ブルームバーグ●●　日本時間（UTC+9）
    ●●BBC●●　UTC
    ●●国内etc●●　日本時間（UTC+9）
    ●●NYタイムズ●●　UTC
    ●●WSJ●●　日本時間（UTC+9）
    ●●ヤフー●●　日本時間（UTC+9）
    ●●AI関連●●　日本時間（UTC+9）
  
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text();
  fs.writeFileSync('summary1.txt', summaryText);
}

run();
