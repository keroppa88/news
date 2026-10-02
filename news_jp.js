// ●日経・読売・産経・47・みんかぶ
// rss.wor.jp（RSS愛好会）がまとめている各紙のRSSから、政治・経済・社会・ビジネス・マーケット・スポーツを取得

const { saveRss } = require('./rss');

const BASE = 'https://assets.wor.jp/rss/rdf';

// [ラベル, rss.wor.jp のパス]
const FEEDS = [
  ['日経/政治経済', 'nikkei/economy'],
  ['日経/社会', 'nikkei/society'],
  ['日経/ビジネス', 'nikkei/business'],
  ['日経/マーケット', 'nikkei/markets'],
  ['日経/スポーツ', 'nikkei/sports'],
  ['読売/政治', 'yomiuri/politics'],
  ['読売/経済', 'yomiuri/economy'],
  ['読売/社会', 'yomiuri/national'],
  ['産経/政治', 'sankei/politics'],
  ['産経/経済', 'sankei/economy'],
  ['産経/社会', 'sankei/affairs'],
  ['産経/スポーツ', 'sankei/sports'],
  ['47/政治', 'ynnews/politics'],
  ['47/経済', 'ynnews/economics'],
  ['47/社会', 'ynnews/national'],
  ['47/スポーツ', 'ynnews/sports'],
  ['みんかぶ/株式', 'minkabufx/stock'],
  ['みんかぶ/要人発言', 'minkabufx/statement'],
  ['みんかぶ/商品債券', 'minkabufx/commodity'],
];

saveRss({
  name: 'news_jp',
  file: 'news_jp.csv',
  urls: FEEDS.map(([label, p]) => ({ label, url: `${BASE}/${p}.rdf` })),
  perFeed: 10,
  max: 200,
});
