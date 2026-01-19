const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../summary.txt');
const outputPath = path.join(__dirname, '../index.html');

try {
    const rawContent = fs.readFileSync(inputPath, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim() !== "");

    let htmlBody = "";

    lines.forEach(line => {
        let cleanLine = line.replace(/\*\*/g, '').replace(/【見出し】/g, '').trim();
        
        // 理由・注目点（「・」で始まる行）以外を見出しと判定
        if (!cleanLine.startsWith('・')) {
            let bgColor = "#eee"; // デフォルト
            if (cleanLine.includes('ロイター')) bgColor = "#d1f0ff"; // 薄い水色
            if (cleanLine.includes('ブルームバーグ')) bgColor = "#d1ffd6"; // 薄い緑
            if (cleanLine.includes('ヤフー')) bgColor = "#ffffd1"; // 薄い黄色

            // 見出し行のスタイル適用
            htmlBody += `<div style="background-color: ${bgColor}; font-weight: bold; margin-top: 2px;">${cleanLine}</div>`;
        } else {
            // 詳細行
            htmlBody += `<div style="margin-left: 5px;">${cleanLine}</div>`;
        }
    });

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>News</title>
    <style>
        body {
            font-family: sans-serif;
            font-size: 11px;      /* さらに小さく */
            line-height: 1.2;     /* 行間を極限まで詰める */
            color: #000;
            margin: 0;
            padding: 2px;         /* 画面端の余白を最小限に */
            background-color: #fff;
        }
        .date-header {
            font-size: 9px;
            color: #666;
            text-align: right;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="date-header">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>
    ${htmlBody}
</body>
</html>
`;

    fs.writeFileSync(outputPath, html);
    console.log('Successfully generated compact color-coded index.html');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
