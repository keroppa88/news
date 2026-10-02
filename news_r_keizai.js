// ●ロイター経済
// jp.reuters.com はボット判定で遮断されるため、GoogleニュースのRSSから取得

const { saveRss, googleNewsUrl } = require('./rss');

saveRss({
  name: 'news_r_keizai',
  file: 'news_r_keizai.csv',
  urls: [googleNewsUrl('site:reuters.com 経済 when:1d')],
  exclude: /Stock Price/i,
});
