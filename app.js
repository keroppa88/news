const $ = s => document.querySelector(s);
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {important:'重要ニュース',sports:'スポーツ',other:'その他のニュース'};
const storage = {get(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}};
let edition, query = '', font = Number(storage.get('newspaper:font',15)), toastTimer;
font = Number.isFinite(font) ? Math.min(20,Math.max(13,font)) : 15;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2600)}
function allArticles(){return edition ? Object.entries(labels).flatMap(([section])=>edition[section].map((a,i)=>({...a,section,rank:i+1}))) : []}
function shownArticles(){
  const current = allArticles();
  return current.filter(a=>!query||[a.title,a.summary,a.category,...a.sources.map(s=>`${s.title} ${s.media}`)].join(' ').toLocaleLowerCase().includes(query));
}
function valid(data){
  if(!data||data.schemaVersion!==1||!/^\d{4}-\d{2}-\d{2}$/.test(data.date))return false;
  const ids=new Set();
  for(const [key,min,max] of [['important',10,10],['sports',0,3],['other',0,3]]){
    if(!Array.isArray(data[key])||data[key].length<min||data[key].length>max)return false;
    for(const a of data[key]){
      if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.title!=='string'||!a.title.trim()||a.title.length>120||typeof a.summary!=='string'||!a.summary.trim()||a.summary.length>600||typeof a.category!=='string'||!Array.isArray(a.sources)||!a.sources.length||a.sources.some(s=>!s||typeof s.title!=='string'||typeof s.media!=='string'||typeof s.date!=='string'))return false;
      ids.add(a.id);
    }
  }
  return true;
}
function media(a){return [...new Set(a.sources.map(s=>s.media))]}
function newsSearchUrl(title){return `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=ja&gl=JP&ceid=JP%3Aja`}
function card(a){const ms=media(a);return `<article class="story" id="story-${escape(a.id)}" data-id="${escape(a.id)}"><div class="story-top"><span class="story-rank">${String(a.rank).padStart(2,'0')}</span><span class="story-kicker">${escape(a.category)}</span>${a.rank===1&&a.section==='important'?'<span class="eyebrow">／ TOP STORY</span>':''}</div><h3 class="story-title"><a href="${newsSearchUrl(a.title)}" target="_blank" rel="noopener noreferrer" aria-label="Googleニュースで検索：${escape(a.title)}">${escape(a.title)}</a></h3><p class="story-summary">${escape(a.summary)}</p><div class="story-bottom"><span class="source-line"><b>${escape(ms.join(' ・ '))}</b>${ms.length>1?` <span>／ ${ms.length}媒体</span>`:''}</span><button class="evidence-button" data-open="${escape(a.id)}">掲載見出し ${a.sources.length}件 ↗</button></div></article>`}
function render(){
  const shown=shownArticles(), filtering=!!query;
  for(const section of Object.keys(labels)){
    const items=shown.filter(a=>a.section===section);
    $(`#${section}-grid`).innerHTML=items.map(card).join('')||(!filtering?`<p class="section-empty">${escape(edition.omissions?.[section]||'今回の収集データに該当する記事はありません。')}</p>`:'');
    $(`#${section}`).hidden=filtering&&!items.length;
    $(`#${section}-count`).textContent=`${items.length} TOPIC${items.length===1?'':'S'}`;
  }
  $('#important-grid').classList.toggle('filtered',!!filtering);
  $('#empty-state').hidden=shown.length>0;
  $('#reset-filter').hidden=!filtering;
  $('#main-content').setAttribute('aria-busy','false');
}
function applyEdition(data, mode){
  edition=data;
  const d=new Date(`${data.date}T12:00:00+09:00`);
  $('#issue-date').textContent=new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(d);
  $('#issue-time').textContent=`${data.sourceUpdatedAt || data.date} 更新分`;
  $('#issue-stats').textContent=`重要 ${data.important.length} ｜ スポーツ ${data.sports.length} ｜ その他 ${data.other.length}`;
  $('#sync-status').textContent=mode;
  $('#footer-date').textContent=`${data.date} 号 ｜ 見出し収集：既存ニュースシステム ｜ 記事化：${data.editorLabel || 'AI'} ｜ ${allArticles().length} topics`;
  render();
  if(location.hash.startsWith('#article-'))openArticle(location.hash.slice(9),false);
}
async function getJSON(url){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const json=await response.json();if(!valid(json))throw Error('Invalid edition');return json}
async function refresh(){
  $('#refresh').disabled=true;$('#sync-status').textContent='新聞用の記事データを確認しています…';
  try{
    const config=await fetch('config.json',{cache:'no-store'}).then(r=>r.json());
    const remote=await getJSON(config.feedUrl || 'newspaper.json');
    if(edition&&remote.date<edition.date)throw Error('Older edition');
    storage.set('newspaper:edition',remote);
    applyEdition(remote,`新聞用の記事データを確認しました。${remote.date} 号${remote.preview?'・確認用紙面':''}を表示中。`);toast('紙面のデータを再読み込みしました');
  }catch{
    $('#sync-status').textContent=`${edition?.date||''} 号を表示中。更新データを取得できなかったため、現在の紙面を保持しています。`;
    toast('更新データを取得できませんでした');
  }finally{$('#refresh').disabled=false}
}
function findArticle(id){return allArticles().find(a=>a.id===id)}
function openArticle(id,changeHash=true){const a=findArticle(id);if(!a)return;
  $('#article-category').textContent=a.category;
  $('#article-content').innerHTML=`<h2 id="article-title" class="dialog-title">${escape(a.title)}</h2><p class="dialog-summary">${escape(a.summary)}</p><h3 class="evidence-heading">掲載見出し <span>${a.sources.length}件</span></h3><p class="evidence-note">以下の見出しをもとに、短い記事にまとめています。媒体名・日付は収集データの表記です。</p><ul class="source-list">${a.sources.map(s=>`<li><strong>${escape(s.media)}</strong><p>${escape(s.title)}</p><small>${escape(s.date)}</small></li>`).join('')}</ul><div class="article-dialog-actions"><a href="${newsSearchUrl(a.title)}" target="_blank" rel="noopener noreferrer">Googleニュースで検索 ↗</a><button data-copy="${escape(a.id)}">記事のリンクをコピー</button></div>`;
  if(!$('#article-dialog').open)$('#article-dialog').showModal();
  if(changeHash)history.replaceState(null,'',`#article-${encodeURIComponent(id)}`);
}
function setFont(){document.documentElement.style.setProperty('--body-size',`${font}px`);$('#font-down').disabled=font<=13;$('#font-up').disabled=font>=20;storage.set('newspaper:font',font)}
function reset(){query='';$('#search').value='';render()}
document.addEventListener('click',async e=>{
  const open=e.target.closest('[data-open]');if(open){openArticle(open.dataset.open);return}
  const close=e.target.closest('[data-close]');if(close){$(`#${close.dataset.close}`).close();return}
  const copy=e.target.closest('[data-copy]');if(copy){try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}#article-${encodeURIComponent(copy.dataset.copy)}`);toast('リンクをコピーしました')}catch{toast('コピーできませんでした。アドレス欄のURLをご利用ください。')}}
});
for(const d of document.querySelectorAll('dialog')){d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}})}
$('#article-dialog').addEventListener('close',()=>{if(location.hash.startsWith('#article-'))history.replaceState(null,'',location.pathname+location.search)});
$('#search').addEventListener('input',e=>{query=e.target.value.trim().toLocaleLowerCase();render()});
$('#reset-filter').onclick=reset;$('#empty-reset').onclick=reset;
$('#font-down').onclick=()=>{font=Math.max(13,font-1);setFont()};$('#font-up').onclick=()=>{font=Math.min(20,font+1);setFont()};
$('#refresh').onclick=refresh;
$('#to-top').onclick=()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
window.addEventListener('scroll',()=>{$('#to-top').hidden=window.scrollY<650},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('#search').focus()}});
setFont();
try{const local=await getJSON('newspaper.json');const cached=storage.get('newspaper:edition',null);const data=valid(cached)&&cached.date>local.date?cached:local;applyEdition(data,`${data.date} 号${data.preview?'・確認用紙面':''} ｜ 同じ話題の掲載見出しを集約しています。`)}catch{$('#sync-status').textContent='紙面を読み込めませんでした。ページを再読み込みしてください。';$('#main-content').setAttribute('aria-busy','false')}
