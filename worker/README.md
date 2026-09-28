# ニュース更新タイマー（Cloudflare Worker）

毎日 日本時間 7:30 に GitHub へ `repository_dispatch`（`scheduled-news`）を送り、
`.github/workflows/run.yml` を起動する。取得・要約・公開は従来どおり GitHub で行う。
GitHub の schedule は数時間遅れることがあるため、時刻管理だけを Cloudflare に移す。

## 用意するもの

`GH_TOKEN`：GitHub の細粒度PAT。対象は `keroppa88/news` だけ、権限は **Contents: Read and write** だけ。

## 有効化

1. この変更を GitHub の main へ反映する（`repository_dispatch` は main 上の定義を使う）。
2. 配る。初期状態は `SCHEDULE_ENABLED = "false"` なので、まだ合図は送らない。
   ```sh
   cd worker
   npx wrangler login
   npx wrangler secret put GH_TOKEN
   npx wrangler deploy
   ```
3. 7:30 を避けて切り替える。GitHub の Settings → Secrets and variables → Actions →
   Variables に `CLOUDFLARE_SCHEDULE` = `true` を追加する。
   これで GitHub の schedule 起動だけが止まる。手動の Run workflow は使える。
4. `wrangler.toml` の `SCHEDULE_ENABLED` を `"true"` に変えて、もう一度 `npx wrangler deploy`。
   この変更もリポジトリへ保存する。
5. 翌朝、Cloudflare のログに `dispatch accepted: scheduled-news`、
   GitHub の Actions に `repository_dispatch` の実行が出ることを確認する。

GitHub と Cloudflare の両方のタイマーを同時に有効にしないこと。
元に戻すときは、Worker を `"false"` に戻してから GitHub 変数を `false` に戻す。

## 時刻を変えたいとき

`wrangler.toml` の `crons`（UTC）を直して `npx wrangler deploy`。
日本時間 = UTC + 9時間。例：7:30 JST → `30 22 * * *`。

## 動きを見る

```sh
npx wrangler tail
```

検証: `node --test worker/schedule.test.mjs`
