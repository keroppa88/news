// Run after web/format.js: add two explicit display modes at the top-left.
const fs = require('fs');
const path = require('path');
const filename = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(filename, 'utf8');
const nav = `<nav class="newspaper-navigation" aria-label="表示モード"><a href="./" aria-current="page">通常モード</a><a href="paper-newspaper.html">紙新聞風</a></nav>`;
const css = `<style id="newspaper-navigation-style">.newspaper-navigation{display:flex;justify-content:flex-start;gap:4px;margin:3px 4px 5px}.newspaper-navigation a{display:inline-block;padding:3px 7px;border:1px solid #777;border-radius:2px;color:#222;background:#fff;font:11px/1.25 sans-serif;text-decoration:none}.newspaper-navigation a[aria-current=page]{background:#222;border-color:#222;color:#fff}.newspaper-navigation a:hover,.newspaper-navigation a:focus-visible{border-color:#a54d38;color:#a54d38}.newspaper-navigation a[aria-current=page]:hover{color:#fff}</style>`;
if (html.includes('class="newspaper-navigation"')) {
  html = html.replace(/<nav class="newspaper-navigation"[^>]*>[\s\S]*?<\/nav>/, nav);
} else {
  html = html.replace(/(<body[^>]*>)/i, '$1\n    ' + nav);
  html = html.replace('</head>', css + '\n</head>');
}
fs.writeFileSync(filename, html);
console.log('Two display-mode buttons added at the top-left.');
