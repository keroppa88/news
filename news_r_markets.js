// ●ロイター市場
// jp.reuters.com はボット判定で遮断されるため、GoogleニュースのRSSから取得

const { saveRss, googleNewsUrl } = require('./rss');

saveRss({
  name: 'news_r_markets',
  file: 'news_r_markets.csv',
  urls: [googleNewsUrl('site:reuters.com 市場 when:1d')],
  exclude: /Stock Price/i,
});
