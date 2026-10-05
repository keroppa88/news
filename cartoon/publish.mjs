import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function insertCartoon(html,manifest){
  html=html.replace(/<!-- EDITORIAL_CARTOON_START -->[\s\S]*?<!-- EDITORIAL_CARTOON_END -->\s*/g,'');
  if(!manifest)return html;
  const anchor=/<div[^>]*>\s*<img\s+[^>]*src="wordcloud\.jpg[^">]*"[^>]*>\s*<\/div>/;
  if(!anchor.test(html))throw Error('Word cloud insertion point not found');
  const figure=`<!-- EDITORIAL_CARTOON_START --><figure class="editorial-cartoon" style="margin:0 0 12px" lang="ja"><img src="editorial-cartoon.png?v=${encodeURIComponent(manifest.sourceHash)}" width="1536" height="1152" style="display:block;width:100%;height:auto;aspect-ratio:4/3" alt="${esc(manifest.title)}"><figcaption style="font:700 18px/1.3 Georgia,'Yu Mincho','Hiragino Mincho ProN',serif;text-align:center;margin-top:5px">${esc(manifest.title)}</figcaption><div style="font:10px/1.3 sans-serif;text-align:right;margin-top:3px">${esc(manifest.date)}</div></figure><!-- EDITORIAL_CARTOON_END -->\n`;
  return html.replace(anchor,match=>figure+match);
}
export function publish(root=ROOT){
  const file=path.join(root,'index.html');let manifest=null;
  if(fs.existsSync(path.join(root,'editorial-cartoon.json'))&&fs.existsSync(path.join(root,'editorial-cartoon.png')))manifest=JSON.parse(fs.readFileSync(path.join(root,'editorial-cartoon.json'),'utf8'));
  fs.writeFileSync(file,insertCartoon(fs.readFileSync(file,'utf8'),manifest));
  console.log(manifest?'Published cartoon above word cloud':'No cartoon available yet');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))publish();
