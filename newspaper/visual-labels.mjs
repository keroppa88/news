// Fixed English spellings avoid accepting a typo just because OCR repeats it.
// Use concepts, not unverified transliterations of people's names.
export const conceptLabels = [
  ['内閣','CABINET'],['政府','GOVERNMENT'],['国会','PARLIAMENT'],
  ['選挙','ELECTION'],['政治資金','POLITICAL FUNDS'],['裏金','SLUSH FUNDS'],
  ['関税','TARIFFS'],['税','TAX'],['予算','BUDGET'],['債務','DEBT'],
  ['銀行','BANKS'],['金利','INTEREST RATES'],['利上げ','RATE HIKE'],
  ['利下げ','RATE CUT'],['物価','PRICES'],['インフレ','INFLATION'],
  ['賃金','WAGES'],['雇用','JOBS'],['株価','STOCKS'],['市場','MARKETS'],
  ['貿易','TRADE'],['輸出','EXPORTS'],['輸入','IMPORTS'],
  ['石油','OIL'],['原油','OIL'],['エネルギー','ENERGY'],
  ['住宅','HOUSING'],['年金','PENSIONS'],['医療','HEALTH CARE'],
  ['教育','EDUCATION'],['気候','CLIMATE'],['洪水','FLOODS'],
  ['地震','EARTHQUAKE'],['戦争','WAR'],['停戦','CEASEFIRE'],
  ['平和','PEACE'],['防衛','DEFENSE'],['人工知能','AI'],['半導体','CHIPS']
];

export function selectVerifiedLabels(labels, sourceText) {
  const words=[];
  for(const label of Array.isArray(labels)?labels:[]){
    if(typeof label?.source!=='string'||!sourceText.includes(label.source))continue;
    const match=conceptLabels.find(([source])=>label.source.includes(source));
    if(match&&!words.includes(match[1]))words.push(match[1]);
    if(words.length===3)break;
  }
  return words;
}
