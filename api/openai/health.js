import { getOpenAiKey, runHandler, sendJson } from "../_lib/openaiProxy.js";

export default async function handler(req, res) {
  await runHandler(req, res, async () => {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = getOpenAiKey();
    sendJson(res, 200, {
      ok: Boolean(apiKey),
      keyConfigured: Boolean(apiKey),
      mode: "server-proxy",
    });
  });
}
