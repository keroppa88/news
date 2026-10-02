// ●WSJ
// jp.wsj.com はボット判定で遮断されるため、GoogleニュースのRSSから取得

const { saveRss, googleNewsUrl } = require('./rss');

saveRss({
  name: 'news_wsj',
  file: 'news_wsj.csv',
  urls: [googleNewsUrl('site:jp.wsj.com when:1d')],
});
