// ●日経・読売テクノロジー
// rss.wor.jp（RSS愛好会）がまとめている日経・読売のテクノロジーRSSから取得

const { saveRss } = require('./rss');

const BASE = 'https://assets.wor.jp/rss/rdf';

saveRss({
  name: 'news_jp_tech',
  file: 'news_jp_tech.csv',
  urls: [
    { label: '日経', url: `${BASE}/nikkei/technology.rdf` },
    { label: '読売', url: `${BASE}/yomiuri/science.rdf` },
  ],
  perFeed: 15,
});
