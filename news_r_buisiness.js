// ●ロイター ビジネス
// jp.reuters.com はボット判定で遮断されるため、GoogleニュースのRSSから取得

const { saveRss, googleNewsUrl } = require('./rss');

saveRss({
  name: 'news_r_buisiness',
  file: 'news_r_buisiness.csv',
  urls: [googleNewsUrl('site:reuters.com 企業 when:1d')],
  exclude: /Stock Price/i,
});
