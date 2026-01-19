const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../summary.txt');
const outputPath = path.join(__dirname, '../index.html');

try {
    const rawContent = fs.readFileSync(inputPath, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim() !== "");

    let htmlBody = "";

    lines.forEach(line => {
        // 不要な記号や【見出し】表記を完全に除去
        let cleanLine = line.replace(/\*\*/g, '').replace(/【見出し】/g, '').trim();
        
        if (!cleanLine.startsWith('・')) {
            // 見出し行の背景色判定
            let bgColor = "transparent"; // デフォルトは透明（白）
            if (cleanLine.includes('ロイター')) bgColor = "#d1f0ff";    // 薄い水色
            if (cleanLine.includes('ブルームバーグ')) bgColor = "#d1ffd6"; // 薄い緑
            if (cleanLine.includes('ヤフー')) bgColor = "#ffffd1";      // 薄い黄色

            // 「)」の位置を探して、そこまでだけに色を付ける
            const bracketIndex = cleanLine.indexOf(')');
            if (bracketIndex !== -1 && bgColor !== "transparent") {
                const sourcePart = cleanLine.substring(0, bracketIndex + 1);
                const restPart = cleanLine.substring(bracketIndex + 1);
                
                htmlBody += `<div style="margin-top: 4px; font-weight: bold; background-color: #fff;">` +
                            `<span style="background-color: ${bgColor}; padding: 0 2px;">${sourcePart}</span>` +
                            `${restPart}</div>`;
            } else {
                // 背景指定がない媒体、または「)」がない場合は背景色なし（白）で表示
                htmlBody += `<div style="margin-top: 4px; font-weight: bold; background-color: #fff;">${cleanLine}</div>`;
            }
        } else {
            // 理由・注目点の行（背景は常に白）
            htmlBody += `<div style="margin-left: 8px; color: #333; background-color: #fff;">${cleanLine}</div>`;
        }
    });

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>News Summary</title>
    <style>
        body {
            font-family: sans-serif;
            font-size: 11px;
            line-height: 1.25;
            color: #000;
            margin: 0;
            padding: 2px;
            background-color: #fff; /* 全体の背景を白に固定 */
        }
        .update-time {
            font-size: 9px;
            color: #888;
            text-align: right;
            margin-bottom: 2px;
            background-color: #fff;
        }
    </style>
</head>
<body>
    <div class="update-time">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 更新</div>
    ${htmlBody}
</body>
</html>
`;

    fs.writeFileSync(outputPath, html);
    console.log('Successfully generated index.html (White background except source tags)');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
