const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const csvData = fs.readFileSync('summary2.txt', 'utf8');

  const prompt = `
    ニュースまとめ情報を最終チェックします。要件は2点のみです。それ以外のことはしないように。
    要件1
    1、入力文書はニュース見出し、媒体、時系列をカテゴリー別に分けたもの。これら中には英文が混じっている可能性がある。これを解決する。
    2，英文は日本語訳にする。英文がある場合は前工程での処理ミスなので、必ずこの翻訳処理をする。日本で一般的な固有名詞は英語のままでよい。
    3，英文が混じっている場合に日本語訳にする。これ以外の部分については、そのまま出力する。念のために表記構成を以下に示す。省略や削除は絶対に行ってはならない。
    要件2
    1、前工程での処理ミスにより、媒体名が（）の外に記述されている場合がある。この場合は媒体名を（）の中に並列して記す。（ロイター、日経、WSJ等）。3媒体以上の場合は等を付けて、それ以降を省略する。
    2、前工程での処理ミスにより、「記事見出し」（媒体）年月日　の並び順が崩れている場合がある。その場合は修正する。
  
    正しい表記例：トランプ大統領、関税を15％に引き上げ(ロイター、WSJ、日経等) 2026/02/26
    
    最終チェック
    成果物のみを示すこと。私信や報告は一切不要。「はい、承知いたしました。以下にニュースリストを分析し、厳選したニュースとまとめを提示します。」「上記リストを翻訳しました。」等という文言は不要。提示してはならない。


    表記法則
    ※「はい、承知いたしました。以下にニュースリストを分析し、厳選したニュースとまとめを提示します。」この文言は不要！削除すること。提示してはならない。
    ※以下のカテゴリー配置や順番を壊してはならない。余計なものを足したり、カテゴリーを減らすのは厳禁。
    
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
