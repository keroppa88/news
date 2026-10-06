const fs = require('node:fs');

const EDITORIAL_MIN = { '重要ニュース': 10, '経済ニュース': 10, '国内ニュース': 5, '海外ニュース': 5, 'その他ニュース': 5 };

const MEDIA_LIMITS = { 'ロイター': 5, 'ブルームバーグ': 5, 'BBC': 5, 'NYタイムズ': 5, 'WSJ': 5, 'AXIOS': 5, '日経': 5, '時事': 5, '日経・読売・産経・47・みんかぶ': 10, '日経・読売、テクノロジー': 3, 'yahoo': 5, 'AI関連': 5, '2ch': 5 };

function limitArticles(text) {
  let limit = Infinity, count = 0;
  return normalize(text).split('\n').filter(line => {
    const header = line.match(/^●([^●]+)●$/);
    if (header) { limit = MEDIA_LIMITS[header[1]] ?? Infinity; count = 0; }
    return !/^\d+\.\s/.test(line) || ++count <= limit;
  }).join('\n');
}

function normalize(text) {
  return text.split('\n').map(line => {
    const clean = line.trim().replace(/^#{1,6}\s*/, '').replace(/^\*\*(.*?)\*\*$/, '$1');
    const header = clean.match(/^●+\s*([^●]+?)\s*●+$/);
    if (header) return `●${header[1]}●`;
    return line.trim().replace(/^(\d+)[.．、)]\s*/, '$1. ');
  }).filter(line => !/^```/.test(line)).join('\n');
}

function needsTranslation(line) {
  const headline = line.replace(/^\d+\.\s*/, '').replace(/[（(][^）)]*[）)]\s*\d{4}\/\d{2}\/\d{2}\s*$/, '').trim();
  const japanese = (headline.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
  const words = headline.match(/[A-Za-z]{2,}/g) || [];
  const letters = words.join('').length;
  return words.length >= 2 && (japanese < 3 || letters > japanese * 3);
}

function validate(text, { japanese = true } = {}) {
  const sections = {};
  let current;
  for (const line of normalize(text).split('\n')) {
    const header = line.match(/^●([^●]+)●$/);
    if (header) { current = header[1]; sections[current] ||= []; }
    else if (current && /^\d+\.\s/.test(line)) sections[current].push(line);
  }
  for (const [name, min] of Object.entries(EDITORIAL_MIN)) {
    if ((sections[name]?.length || 0) < min) throw new Error(`${name}: fewer than ${min} articles`);
  }
  for (const [name, max] of Object.entries(MEDIA_LIMITS)) {
    if ((sections[name]?.length || 0) > max) throw new Error(`${name}: more than ${max} articles`);
  }
  if (japanese && Object.values(sections).flat().some(needsTranslation)) throw new Error('Untranslated English headlines remain');
  return sections;
}

if (require.main === module) {
  try { validate(fs.readFileSync('summary2.txt', 'utf8')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { normalize, validate, needsTranslation, limitArticles, MEDIA_LIMITS };

