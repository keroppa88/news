const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('news.csv', 'utf8');

  const prompt = `
    以下のニュースリスト（CSV形式）を読み取り、
    「重要ニュース」10個を厳選して、【見出し】・理由と注目点を80文字以内でまとめてください。「注目点：」「理由：」などの表記は不要。
    
    表記例
    【世界経済、成長続く】（ロイタービジネス）2026/01/19
    * 世界の経済成長がずっと続いている。投資戦略に影響を与える可能性がある。
    
    「国内ニュース」5個を厳選して【見出し】を並べてください。
    「海外ニュース」5個を厳選して【見出し】を並べてください。
    「その他ニュース」としてエンタメ、スポーツ、社会などのニュースの中から厳選して2個から5個を並べてください。重要性の低いニュースは提示しない。
    各【見出し】の後ろに（）で囲んで媒体名を表記すること。
    （）で囲んだ中に媒体名を入れる。そのの後に年月日をyyyy/mm/ddの形式で付記すること。
    
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  fs.writeFileSync('summary.txt', result.response.text());
}

run();
