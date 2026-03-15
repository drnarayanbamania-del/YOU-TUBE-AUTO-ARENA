import { getRunwayKey, runRunwayHandler, sendRunwayJson } from "../_lib/runwayProxy.js";

export default async function handler(req, res) {
  await runRunwayHandler(req, res, async () => {
    if (req.method !== "GET") {
      sendRunwayJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = getRunwayKey();
    sendRunwayJson(res, 200, {
      ok: Boolean(apiKey),
      keyConfigured: Boolean(apiKey),
      mode: "server-proxy",
      provider: "runway",
    });
  });
}
