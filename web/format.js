const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../summary2.txt');
const outputPath = path.join(__dirname, '../index.html');

try {
    const rawContent = fs.readFileSync(inputPath, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim() !== "");

    let htmlBody = "";

    lines.forEach(line => {
        let cleanLine = line.trim();
        
        // 箇条書き（* で始まる行）の処理
        if (cleanLine.startsWith('*')) {
            htmlBody += `<div style="margin-left: 10px; color: #333; background-color: #fff; margin-bottom: 8px;">${cleanLine}</div>`;
        } 
        // 見出し行（【 】を含む行）の処理
        else if (cleanLine.includes('【')) {
            let bgColor = "#eee"; 
            if (cleanLine.includes('ロイター')) bgColor = "#d1f0ff";    // 薄い水色
            else if (cleanLine.includes('ブルームバーグ')) bgColor = "#d1ffd6"; // 薄い緑
            else if (cleanLine.includes('ヤフー')) bgColor = "#ffffd1";      // 薄い黄色

            // 【 】の部分だけ背景色を付け、フォントサイズを1.2倍にする
            let styledLine = cleanLine.replace(/【(.*?)】/g, (match) => {
                return `<span style="background-color: ${bgColor}; font-size: 1.2em; padding: 0 2px;">${match}</span>`;
            });

            // 見出し部分のみ太字にする（日付は除外）
            const headlineMatch = styledLine.match(/^(\d+[\.\．]\s*)(.*?)(\s+\d{4}\/\d{2}\/\d{2})$/);
            if (headlineMatch) {
                htmlBody += `<div style="margin-top: 10px; background-color: #fff;">${headlineMatch[1]}<b>${headlineMatch[2]}</b>${headlineMatch[3]}</div>`;
            } else {
                htmlBody += `<div style="margin-top: 10px; font-weight: bold; background-color: #fff;">${styledLine}</div>`;
            }
        }
        else {
            // 番号付きニュース項目の見出しを太字にする（年月日と媒体名は除外）
            // パターン1: 番号. 見出し（媒体名）日付
            const mediaMatch = cleanLine.match(/^(\d+[\.\．]\s*)(.*)([\(（][^）\)]*?[\)）]\s*\d{4}\/\d{2}\/\d{2})$/);
            if (mediaMatch) {
                htmlBody += `<div style="background-color: #fff;">${mediaMatch[1]}<b>${mediaMatch[2]}</b>${mediaMatch[3]}</div>`;
            } else {
                // パターン2: 番号. 見出し 日付
                const dateMatch = cleanLine.match(/^(\d+[\.\．]\s*)(.*?)(\s+\d{4}\/\d{2}\/\d{2})$/);
                if (dateMatch) {
                    htmlBody += `<div style="background-color: #fff;">${dateMatch[1]}<b>${dateMatch[2]}</b>${dateMatch[3]}</div>`;
                } else {
                    // セクションヘッダー、コメント等
                    htmlBody += `<div style="background-color: #fff;">${cleanLine}</div>`;
                }
            }
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
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 5px;
            background-color: #fff;
        }
        .update-time {
            font-size: 9px;
            color: #999;
            text-align: right;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="update-time">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 更新</div>
    <div style="margin-bottom: 10px;"><img src="wordcloud.jpg" alt="Word Cloud" style="max-width: 100%; height: auto;"></div>
    ${htmlBody}
</body>
</html>
`;

    fs.writeFileSync(outputPath, html);
    console.log('Success: Updated HTML with 1.2x headlines and preserved "*" markers.');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
