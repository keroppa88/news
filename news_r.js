// ●ロイター国内
// jp.reuters.com はボット判定で遮断されるため、GoogleニュースのRSSから取得

const { saveRss, googleNewsUrl } = require('./rss');

saveRss({
  name: 'news_r',
  file: 'news_r.csv',
  urls: [googleNewsUrl('site:reuters.com when:1d')],
  exclude: /Stock Price/i,
});
