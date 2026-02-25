const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('summary1.txt', 'utf8');

  const prompt = `
    1. 以下のニュースリストを読んで、以下のように分類編集提示をする。
    2、最初に「本日の総合的なまとめ」を●コメント●として提示する。一つの連続した文章として250～300文字で総合的な分析コメントを作成する。
    3、各媒体の見出し記事を総合的に勘案（各媒体の扱いの大きさ、関連記事の多さなど）して、重要ニュースを10個厳選する。
    4、「重要ニュース」を10個を厳選して　見出し（媒体名）yyyy/mm/dd を記述する。
    重要ニュースは複数媒体が報じるはずなので、報じた媒体を媒体名として、で区切って羅列する。3社以上は「等」と入れたうえで省略する。
    5. 「経済ニュース」10個を厳選　見出しを並べてください。「重要ニュース」の内容と重複しない経済ニュースを選ぶこと。3社以上は「等」と入れたうえで省略する。
    6、「国内ニュース」5個を厳選して　見出しを並べてください。3社以上は「等」と入れたうえで省略する。
    7、「海外ニュース」5個を厳選して　見出しを並べてください。3社以上は「等」と入れたうえで省略する。
    8，「その他ニュース」として芸能、エンタメ、スポーツ、社会などのニュースを厳選して5個～10個を並べてください。2chから2つ以上取り上げる。多様なニュース示す項目。
    各　見出しの後ろに（）で囲んで媒体名を表記すること。
    9、（）で囲んだ中に媒体名を入れる。そのの後に年月日をyyyy/mm/ddの形式で付記すること。
    10、各媒体ごとに主要な記事を5つずつ提示していく。複数社が報じていないユニークな記事を必ず含ませる。
    11、最終チェック1、成果物のみを示すこと。私信や報告は一切不要。「はい、承知いたしました。以下にニュースリストを分析し、厳選したニュースとまとめを提示します。」「上記リストを翻訳しました。」等という文言は不要。提示してはならない。
    12、最終チェック2、全ての出力は日本語で行うこと。英文がある場合は必ず日本語訳にする。
    13、最終チェック3、出力から文字列「【】」は削除する。新たに「【】」を付け足す処理を行ってはならない、絶対ダメ。
    14、以下に表記例を示す。

    表記法則
    ※「はい、承知いたしました。以下にニュースリストを分析し、厳選したニュースとまとめを提示します。」この文言は不要！削除すること。提示してはならない。
    ※以下の表記例、カテゴリーの配置、種類を守ること。カテゴリーの順番を変えたり減らしたりするのは厳禁。
   
    ●コメント(Gemini)●
    国内では○○、海外では●●●、○○が話題となりました。 ～省略～国内株式市場では●●●が〇しました。
  
    ●重要ニュース●
    1. 記事見出し（ロイター、ブルームバーグ、BBC等）2026/02/20
    ～省略～10個のニュースを選択
   10. 記事見出し（日経、NYタイムス、BBC）2026/02/20

    ●経済ニュース●
    1.記事見出し（ブルームバーグ、BBC）2026/02/20
    ～省略～10個のニュースを選択
   10. 記事見出し（日経、NYタイムス、BBC）2026/02/20
    ●国内ニュース●
    ～省略～5個のニュースを選択
    ●海外ニュース●
    ～省略～5個のニュースを選択
    ●その他ニュース●
    ～省略～5個のニュースを選択
    
    ●ロイター●
    ～省略～5個のニュースを選択
    ●ブルームバーグ●
    ～省略～5個のニュースを選択
    ●BBC●
    ～省略～5個のニュースを選択
    ●NYタイムズ●
    ～省略～5個のニュースを選択
    ●WSJ●
    ～省略～5個のニュースを選択
    ●日経●
    ～省略～5個のニュースを選択
    ●時事●
    ～省略～5個のニュースを選択
    ●yahoo●
    ～省略～5個のニュースを選択
    ●AI関連●
    ～省略～5個のニュースを選択
    ●2ch●
    ～省略～5個のニュースを選択
  
    リスト：
    ${csvData}
  `;

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text().replace(/[【】]/g, '');
  fs.writeFileSync('summary2.txt', summaryText);

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
