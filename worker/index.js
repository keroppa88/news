// 決まった時刻に GitHub へ「ニュース更新を始めて」と合図を送るだけのWorker。
// 取得・要約・公開は従来どおり GitHub Actions（run.yml）が行う。

export const EVENT_TYPE = "scheduled-news";

export async function runSchedule(controller, env, send = fetch) {
  // 配備だけでは有効化しない。GitHub側の切替と合わせて設定する。
  if (env.SCHEDULE_ENABLED !== "true") return;
  if (!env.GH_TOKEN || !env.GH_REPO) throw new Error("GH_TOKEN / GH_REPO が未設定");
  const response = await send(`https://api.github.com/repos/${env.GH_REPO}/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GH_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "news-timer"
    },
    body: JSON.stringify({
      event_type: EVENT_TYPE,
      client_payload: { scheduled_at: new Date(controller.scheduledTime).toISOString() }
    })
  });
  // 応答不明時の自動再送は二重起動になるため行わず、失敗をログへ残す。
  if (response.status !== 204) throw new Error(`GitHub HTTP ${response.status}`);
  console.log(`dispatch accepted: ${EVENT_TYPE}`);
}

export default {
  async scheduled(controller, env) {
    await runSchedule(controller, env);
  }
};
