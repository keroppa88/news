const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  const csvData = fs.readFileSync('news.csv', 'utf8');

  const prompt = `
    以下のニュースリスト（CSV形式）を読み取り、重要ニュースを3つ厳選して、
    【見出し】・理由・注目点 の形式でまとめてください。
    
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  fs.writeFileSync('summary.txt', result.response.text());
}

run();
