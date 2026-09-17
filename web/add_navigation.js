// Run after web/format.js: preserve the original news page and add two links.
const fs = require('fs');
const path = require('path');
const filename = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(filename, 'utf8');
const nav = `<nav class="newspaper-navigation" aria-label="新聞表示の切り替え"><a href="print.html">印刷用表示</a><a href="newspaper.html">新聞風表示</a></nav>`;
const css = `<style id="newspaper-navigation-style">.newspaper-navigation{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 10px}.newspaper-navigation a{display:inline-block;padding:7px 12px;border:1px solid #777;border-radius:3px;color:#111;background:#fff;font:14px sans-serif;text-decoration:none}.newspaper-navigation a:hover,.newspaper-navigation a:focus-visible{background:#f0f0f0}@media(max-width:400px){.newspaper-navigation a{font-size:12px;padding:7px 9px}}</style>`;
if (!html.includes('class="newspaper-navigation"')) {
  const imageBlock = /(<div\s+style="margin-bottom:\s*10px;"\s*>\s*<img\b[^>]*>\s*<\/div>)/i;
  if (!imageBlock.test(html)) throw new Error('Wordcloud image block not found; navigation was not inserted.');
  html = html.replace(imageBlock, '$1\n        ' + nav);
  html = html.replace('</head>', css + '\n</head>');
  fs.writeFileSync(filename, html);
}
console.log('Newspaper navigation added to generated homepage.');
