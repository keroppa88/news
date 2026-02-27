const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../summary2.txt');
const outputPath = path.join(__dirname, '../index.html');

try {
    const rawContent = fs.readFileSync(inputPath, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim() !== "");

    // カテゴリー（●...●）ごとにグループ化する
    const sections = [];
    let currentSection = null;

    lines.forEach(line => {
        let cleanLine = line.trim();

        // ●...● パターンでカテゴリーヘッダーを検出
        const categoryMatch = cleanLine.match(/^●(.+?)●$/);
        if (categoryMatch) {
            currentSection = { title: cleanLine, items: [] };
            sections.push(currentSection);
        } else if (currentSection) {
            currentSection.items.push(cleanLine);
        } else {
            // カテゴリーヘッダーの前にある行（通常はない）
            sections.push({ title: null, items: [cleanLine] });
        }
    });

    let htmlBody = "";

    sections.forEach(section => {
        let sectionHtml = "";

        if (section.title) {
            sectionHtml += `<div class="category-title">${section.title}</div>`;
        }

        section.items.forEach(cleanLine => {
            // 箇条書き（* で始まる行）の処理
            if (cleanLine.startsWith('*')) {
                sectionHtml += `<div class="news-item" style="margin-left: 10px; color: #333; margin-bottom: 8px;">${cleanLine}</div>`;
            }
            // 見出し行（【 】を含む行）の処理
            else if (cleanLine.includes('【')) {
                let bgColor = "#eee";
                if (cleanLine.includes('ロイター')) bgColor = "#d1f0ff";
                else if (cleanLine.includes('ブルームバーグ')) bgColor = "#d1ffd6";
                else if (cleanLine.includes('ヤフー')) bgColor = "#ffffd1";

                let styledLine = cleanLine.replace(/【(.*?)】/g, (match) => {
                    return `<span style="background-color: ${bgColor}; font-size: 1.2em; padding: 0 2px;">${match}</span>`;
                });

                const headlineMatch = styledLine.match(/^(\d+[\.\．]\s*)(.*?)(\s+\d{4}\/\d{2}\/\d{2})$/);
                if (headlineMatch) {
                    sectionHtml += `<div class="news-item" style="margin-top: 10px;">${headlineMatch[1]}<b>${headlineMatch[2]}</b>${headlineMatch[3]}</div>`;
                } else {
                    sectionHtml += `<div class="news-item" style="margin-top: 10px; font-weight: bold;">${styledLine}</div>`;
                }
            }
            else {
                // 番号付きニュース項目の見出しを太字にする
                const mediaMatch = cleanLine.match(/^(\d+[\.\．]\s*)(.*)([\(（][^）\)]*?[\)）]\s*\d{4}\/\d{2}\/\d{2})$/);
                if (mediaMatch) {
                    sectionHtml += `<div class="news-item">${mediaMatch[1]}<b>${mediaMatch[2]}</b>${mediaMatch[3]}</div>`;
                } else {
                    const dateMatch = cleanLine.match(/^(\d+[\.\．]\s*)(.*?)(\s+\d{4}\/\d{2}\/\d{2})$/);
                    if (dateMatch) {
                        sectionHtml += `<div class="news-item">${dateMatch[1]}<b>${dateMatch[2]}</b>${dateMatch[3]}</div>`;
                    } else {
                        // コメント本文等
                        sectionHtml += `<div>${cleanLine}</div>`;
                    }
                }
            }
        });

        if (section.title) {
            htmlBody += `<div class="category">${sectionHtml}</div>`;
        } else {
            htmlBody += sectionHtml;
        }
    });

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
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
        .container {
            max-width: 960px;
            width: 100%;
        }
        .container img {
            max-width: 960px;
            width: 100%;
            height: auto;
        }
        .category {
            border: 1px solid #ccc;
            padding: 6px 8px;
            margin-bottom: 6px;
        }
        .category-title {
            font-weight: bold;
            margin-bottom: 4px;
        }
        .news-item {
            margin-bottom: 2px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="update-time">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 更新</div>
        <div style="margin-bottom: 10px;"><img src="wordcloud.jpg?t=${Date.now()}" alt="Word Cloud"></div>
        ${htmlBody}
    </div>
</body>
</html>
`;

    fs.writeFileSync(outputPath, html);
    console.log('Success: Updated HTML with container, category boxes, and text wrapping.');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
