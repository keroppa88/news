// Run after web/format.js: preserve the original page and add one newspaper-view button.
const fs = require('fs');
const path = require('path');
const filename = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(filename, 'utf8');
const nav = `<div class="newspaper-navigation"><a href="newspaper.html">新聞風</a></div>`;
const css = `<style id="newspaper-navigation-style">.newspaper-navigation{display:flex;justify-content:flex-end;margin:4px 0 10px}.newspaper-navigation a{display:inline-block;padding:7px 18px;border:1px solid #172b41;border-radius:3px;color:#172b41;background:#fff;font:700 13px sans-serif;text-decoration:none}.newspaper-navigation a:hover,.newspaper-navigation a:focus-visible{background:#eef1f3}</style>`;
if (!html.includes('class="newspaper-navigation"')) {
  const imageBlock = /(<div\s+style="margin-bottom:\s*10px;"\s*>\s*<img\b[^>]*>\s*<\/div>)/i;
  if (!imageBlock.test(html)) throw new Error('Wordcloud image block not found; newspaper button was not inserted.');
  html = html.replace(imageBlock, '$1\n        ' + nav);
  html = html.replace('</head>', css + '\n</head>');
  fs.writeFileSync(filename, html);
}
console.log('Newspaper button added below the wordcloud.');
