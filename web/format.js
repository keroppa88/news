const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../summary.txt');
const outputPath = path.join(__dirname, '../index.html');

try {
    const rawContent = fs.readFileSync(inputPath, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim() !== "");

    let htmlBody = "";

    lines.forEach(line => {
        // 不要なマークダウン記号などを削除
        let cleanLine = line.replace(/\*\*/g, '').replace(/【見出し】/g, '').trim();
        
        if (!cleanLine.startsWith('・')) {
            // 1. 媒体別の色を決定
            let bgColor = ""; 
            if (cleanLine.includes('ロイター')) bgColor = "#d1f0ff";    // 薄い水色
            else if (cleanLine.includes('ブルームバーグ')) bgColor = "#d1ffd6"; // 薄い緑
            else if (cleanLine.includes('ヤフー')) bgColor = "#ffffd1";      // 薄い黄色

            // 2. 「)」の位置を探して色を塗る範囲を決める
            const bracketIndex = cleanLine.indexOf(')');
            
            if (bgColor !== "" && bracketIndex !== -1) {
                // カッコがある場合：カッコまでを色付け、以降は白
                const sourcePart = cleanLine.substring(0, bracketIndex + 1);
                const restPart = cleanLine.substring(bracketIndex + 1);
                
                htmlBody += `<div style="margin-top: 4px; font-weight: bold; background-color: #fff;">` +
                            `<span style="background-color: ${bgColor}; padding: 0 2px;">${sourcePart}</span>` +
                            `${restPart}</div>`;
            } else if (bgColor !== "") {
                // カッコがないがキーワードはある場合：行全体ではなく冒頭に色（念のため）
                htmlBody += `<div style="margin-top: 4px; font-weight: bold; background-color: #fff;">` +
                            `<span style="background-color: ${bgColor}; padding: 0 2px;">${cleanLine.substring(0, 10)}</span>` +
                            `${cleanLine.substring(10)}</div>`;
            } else {
                // 背景指定がない媒体、またはキーワードがない場合は背景なし（白）
                htmlBody += `<div style="margin-top: 4px; font-weight: bold; background-color: #fff;">${cleanLine}</div>`;
            }
        } else {
            // 理由・注目点の行（背景は白）
            htmlBody += `<div style="margin-left: 8px; color: #333; background-color: #fff;">${cleanLine}</div>`;
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
            font-size: 11px;
            line-height: 1.2;
            color: #000;
            margin: 0;
            padding: 2px;
            background-color: #fff;
        }
        .update-time {
            font-size: 9px;
            color: #888;
            text-align: right;
            padding: 2px;
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
    console.log('Fixed! Generated index.html with correct inline background colors.');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
