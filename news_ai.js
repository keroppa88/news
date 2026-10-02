// ●googlenews（AI関連）
// Googleニュースの検索ページはボット判定で遮断されるため、同じ検索のRSSから取得

const { saveRss, googleNewsUrl } = require('./rss');

saveRss({
  name: 'news_ai',
  file: 'news_ai.csv',
  urls: [googleNewsUrl('AI when:1d')],
  keepSource: true,
});
