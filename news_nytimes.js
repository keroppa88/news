// ●ニューヨークタイムズ
// nytimes.com の本体ページは取得できないため、公式RSSから取得

const { saveRss } = require('./rss');

saveRss({
  name: 'news_nytimes',
  file: 'news_nytimes.csv',
  urls: ['https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'],
});
