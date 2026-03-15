import { ensureRunwayKey, runRunwayHandler, runwayRequest, sendRunwayJson } from "../_lib/runwayProxy.js";

export default async function handler(req, res) {
  await runRunwayHandler(req, res, async () => {
    if (req.method !== "GET") {
      sendRunwayJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = ensureRunwayKey(res);
    if (!apiKey) return;

    const { id } = req.query;

    if (!id) {
      sendRunwayJson(res, 400, { error: "Missing task ID" });
      return;
    }

    const payload = await runwayRequest({
      apiKey,
      method: "GET",
      endpoint: `/tasks/${id}`,
    });

    sendRunwayJson(res, 200, {
      ok: true,
      taskId: payload.id,
      status: payload.status,
      progress: payload.progress,
      videoUrl: payload.output?.[0], // Gen-2/3 usually returns array
      error: payload.error,
    });
  });
}
