const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('news.csv', 'utf8');

  const prompt = `
    以下のニュースリスト（CSV形式）を読み取り、
    「重要ニュース」10個を厳選して、【見出し】・理由・注目点 の形式でまとめてください。
    「国内ニュース」5個を厳選して【見出し】を並べてください。
    「海外ニュース」5個を厳選して【見出し】を並べてください。
    「その他ニュース」としてエンタメ、スポーツ、社会などのニュースの中から厳選して2個から5個を並べてください。重要性の低いニュースは提示しない。
    
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  fs.writeFileSync('summary.txt', result.response.text());
}

run();
