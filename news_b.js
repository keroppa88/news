// ●ブルームバーグ
// Googleニュースの検索ページはボット判定で遮断されるため、同じ検索のRSSから取得

const { saveRss, googleNewsUrl } = require('./rss');

saveRss({
  name: 'news_b',
  file: 'news_b.csv',
  urls: [googleNewsUrl('bloomberg when:1d')],
  keepSource: true,
});
