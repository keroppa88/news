const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('summary1.txt', 'utf8');

  const prompt = `
    あなたはニュース分析の専門家です。以下のニュースリストを分析して、ワードクラウド用のキーワードと重要度スコアを抽出してください。

    ## ルール
    1. ニュース全体を俯瞰し、重要なキーワード・トピックを50〜80個抽出する。
    2. 各キーワードに重要度スコア（1〜100）を付与する。スコアの基準：
       - 複数媒体が報じている話題ほど高スコア（最大100）
       - トップニュースや見出しに繰り返し登場するキーワードは高スコア
       - 単一媒体のみの話題は低スコア（10〜30程度）
    3. キーワードは意味のあるまとまりで抽出する（複合語を推奨）。
       - 良い例: 「トランプ関税」「ビッグマック値上げ」「中国輸出禁止」「ウクライナ侵攻」
       - 悪い例: 「トランプ」「関税」を別々に抽出（意味が曖昧になる）
       - ただし、人名・企業名・国名など単独で意味が明確なものはそのまま可（例: 「アンソロピック」「メキシコ」）
    4. 媒体名（ロイター、BBC、ブルームバーグ等）はキーワードに含めない。
    5. 日付、記号、セクション見出しはキーワードに含めない。
    6. 日本語キーワードを主体とするが、固有名詞の英語表記（IBM、COBOL、AI、MLB等）はそのまま使用可。
    7. 「ニュース」「報道」「発表」など一般的すぎる語は除外する。
    8. スポーツ選手名、企業名、政策名など具体的な固有名詞を積極的に含める。

    ## 出力形式
    タブ区切りで「キーワード（タブ）スコア」を1行ずつ出力する。
    スコアの高い順に並べる。
    ヘッダー行や説明文は一切不要。データのみ出力すること。

    出力例:
    トランプ関税\t100
    中国輸出禁止\t90
    ビッグマック値上げ\t85
    アンソロピック\t75
    ウクライナ侵攻\t70

    ## ニュースリスト:
    ${summaryData}
  `;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  fs.writeFileSync('summary3.txt', summaryText);
  
  // Clean: remove markdown code fences if Gemini wraps output
  const cleaned = raw
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim();

  fs.writeFileSync('summary3.txt', cleaned);

  const lines = cleaned.split('\n').filter(l => l.trim());
  console.log(`summary3.txt generated: ${lines.length} keywords`);
  console.log('Top 10:');
  lines.slice(0, 10).forEach(l => console.log(`  ${l}`));
}

run();
