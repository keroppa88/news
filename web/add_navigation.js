// Run after web/format.js: add compact view switches at the top-left.
const fs = require('fs');
const path = require('path');
const filename = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(filename, 'utf8');
const nav = `<nav class="newspaper-navigation" aria-label="表示切り替え"><a href="newspaper.html">新聞風</a><a href="print.html">紙新聞風</a></nav>`;
const css = `<style id="newspaper-navigation-style">.newspaper-navigation{display:flex;justify-content:flex-start;gap:4px;margin:3px 4px 5px}.newspaper-navigation a{display:inline-block;padding:3px 7px;border:1px solid #777;border-radius:2px;color:#222;background:#fff;font:11px sans-serif;text-decoration:none;line-height:1.25}.newspaper-navigation a:hover,.newspaper-navigation a:focus-visible{background:#eef1f3}</style>`;
if (!html.includes('class="newspaper-navigation"')) {
  html = html.replace(/(<body[^>]*>)/i, '$1\n    ' + nav);
  html = html.replace('</head>', css + '\n</head>');
  fs.writeFileSync(filename, html);
}
console.log('Newspaper view buttons added at the top-left.');
