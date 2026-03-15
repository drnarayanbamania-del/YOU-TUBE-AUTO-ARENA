import { ensureApiKey, getApiKey, runHandler, sendJson } from "../_lib/youtubeProxy.js";

export default async function handler(req, res) {
  await runHandler(req, res, async () => {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = getApiKey();
    sendJson(res, 200, {
      ok: Boolean(apiKey),
      mode: "server-proxy",
      keyConfigured: Boolean(apiKey),
    });
  });
}
