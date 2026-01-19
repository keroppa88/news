const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../summary.txt');
const outputPath = path.join(__dirname, '../index.html');

try {
    let content = fs.readFileSync(inputPath, 'utf8');

    // --- テキストのクリーニング ---
    // 1. マークダウンの太字 (**) を削除
    content = content.replace(/\*\*/g, '');
    // 2. 「【見出し】」という文言を削除
    content = content.replace(/【見出し】/g, '');
    // 3. 文頭の余計な改行などを整理
    content = content.trim();

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>News Summary</title>
    <style>
        /* 全体の設定：余白をゼロにし、字を小さく統一 */
        body {
            font-family: sans-serif;
            font-size: 12px;      /* 字を小さく */
            line-height: 1.3;     /* 行間を詰め気味に */
            color: #000;
            margin: 0;            /* 外側余白をゼロに */
            padding: 5px;         /* 内側に最小限の余白 */
            background-color: #fff;
        }
        /* 更新日時 */
        .date {
            font-size: 10px;
            color: #666;
            text-align: right;
            margin: 0;
        }
        /* タイトル見出し：目立たせすぎずコンパクトに */
        h1 {
            font-size: 12px;
            margin: 0 0 5px 0;
            padding: 2px 5px;
            background: #eee;
            border-bottom: 1px solid #ccc;
        }
        /* 本文：マークダウンの崩れを気にせず表示 */
        .content {
            white-space: pre-wrap;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="date">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 更新</div>
    <h1>重要ニュース要約</h1>
    <div class="content">${content}</div>
</body>
</html>
`;

    fs.writeFileSync(outputPath, html);
    console.log('Successfully generated a compact index.html');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
