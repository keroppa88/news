import {readFile,writeFile} from 'node:fs/promises';

const apiKey=process.env.GEMINI_API_KEY;
if(!apiKey)throw new Error('GEMINI_API_KEY is required');

const selectionModel=process.env.DAILY_VISUAL_SELECTION_MODEL||'gemini-2.5-flash-lite';
const imageModel=process.env.DAILY_VISUAL_MODEL||'gemini-2.5-flash-image';
const edition=JSON.parse(await readFile('newspaper.json','utf8'));
const stories=[
  ...edition.important.map((story,index)=>({key:`important:${index}`,section:'important',...story})),
  ...edition.sports.map((story,index)=>({key:`sports:${index}`,section:'sports',...story})),
  ...edition.other.map((story,index)=>({key:`other:${index}`,section:'other',...story}))
];

async function generate(model,body){
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
  });
  if(!response.ok)throw new Error(`Gemini ${model} failed (${response.status}): ${(await response.text()).slice(0,500)}`);
  return response.json();
}

const selectionPrompt=`次の本日のニュースから、新聞のビジュアル欄に載せる題材を1件だけ選んでください。

選択ルール:
- 政治・経済・社会の矛盾、皮肉、対立構造を象徴表現できる題材は satire。
- 風刺に向かず、出来事や時代の空気を一場面で示せる題材は fictional-photo。
- 単なる有名人の肖像より、当日の重要性と画面としての強さを優先。
- 見出しにない事実を追加しない。

JSONだけを返す:
{"storyKey":"important:0","mode":"satire または fictional-photo","concept":"画像にする一場面を日本語で80字以内","caption":"紙面用の短い日本語キャプション。50字以内"}

候補:
${stories.map(s=>`${s.key}\n見出し: ${s.title}\n要約: ${s.summary}`).join('\n\n')}`;

const selectionResponse=await generate(selectionModel,{
  contents:[{parts:[{text:selectionPrompt}]}],
  generationConfig:{responseMimeType:'application/json',temperature:.45,maxOutputTokens:500}
});
const selectionText=selectionResponse.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
if(!selectionText)throw new Error('Visual selection returned no text');
const selection=JSON.parse(selectionText.replace(/^```json\s*|\s*```$/g,''));
const story=stories.find(item=>item.key===selection.storyKey);
if(!story)throw new Error(`Unknown selected story: ${selection.storyKey}`);
const mode=selection.mode==='fictional-photo'?'fictional-photo':'satire';

const style=mode==='satire'
  ? `明治期の日本の新聞風刺画。ジョルジュ・ビゴーを思わせる鋭い観察と細いペン線、白黒線画、クロスハッチング、余白を生かした一場面、誇張された象徴表現。現代的なカラー、写真表現、吹き出し、文字、ロゴ、透かしは使わない。`
  : `昭和後期（1970年代末から1980年代）の新聞に掲載された架空の報道写真。完全な白黒写真だが黒一色ではなく豊かなグレー階調、銀塩フィルムの粒子、やや柔らかな焦点、高感度フィルムらしい粗さ、自然な報道写真の構図。カラー、セピア、文字、ロゴ、透かしは使わない。実在写真の複製にはせず、人物や場面は架空として構成する。`;
const imagePrompt=`${style}\n横長16:9。題材は次のニュース。\n見出し: ${story.title}\n要約: ${story.summary}\n場面の構想: ${String(selection.concept||story.title).slice(0,160)}\n画像内には文章や見出しを描かない。`;

const imageResponse=await generate(imageModel,{
  contents:[{parts:[{text:imagePrompt}]}],
  generationConfig:{responseModalities:['TEXT','IMAGE'],imageConfig:{aspectRatio:'16:9'}}
});
const parts=imageResponse.candidates?.[0]?.content?.parts||[];
const imagePart=parts.find(p=>p.inlineData?.data||p.inline_data?.data);
if(!imagePart)throw new Error('Image model returned no image');
const inline=imagePart.inlineData||imagePart.inline_data;
const extension=inline.mimeType==='image/jpeg'||inline.mime_type==='image/jpeg'?'jpg':'png';
const imagePath=`daily-visual.${extension}`;
await writeFile(imagePath,Buffer.from(inline.data,'base64'));
await writeFile('daily-visual.json',JSON.stringify({
  date:edition.date,
  storyId:story.id,
  storyTitle:story.title,
  mode,
  image:imagePath,
  caption:String(selection.caption||story.title).slice(0,80),
  generatedAt:new Date().toISOString(),
  model:imageModel
},null,2)+'\n');
console.log(JSON.stringify({date:edition.date,story:story.title,mode,image:imagePath,model:imageModel}));
