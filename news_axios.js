// ●AXIOS
// axios.com はCloudflareのボット判定で遮断されるため、GoogleニュースのRSSから取得

const { saveRss, googleNewsUrl } = require('./rss');

saveRss({
  name: 'news_axios',
  file: 'news_axios.csv',
  urls: [googleNewsUrl('site:axios.com when:1d', 'en')],
});
