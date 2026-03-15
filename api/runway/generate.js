import { ensureRunwayKey, runRunwayHandler, runwayRequest, sendRunwayJson } from "../_lib/runwayProxy.js";

export default async function handler(req, res) {
  await runRunwayHandler(req, res, async () => {
    if (req.method !== "POST") {
      sendRunwayJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = ensureRunwayKey(res);
    if (!apiKey) return;

    const body = req.body || {};
    const promptText = body.promptText;
    const model = body.model || "gen3a_turbo";

    if (!promptText) {
      sendRunwayJson(res, 400, { error: "Missing promptText for video generation" });
      return;
    }

    // Runway Gen-3 Alpha Text to Video
    const payload = await runwayRequest({
      apiKey,
      method: "POST",
      endpoint: "/tasks",
      body: {
        taskType: "text_to_video",
        model,
        promptText,
        aspectRatio: "9:16",
        duration: 5,
      },
    });

    sendRunwayJson(res, 201, {
      ok: true,
      taskId: payload.id,
      status: payload.status,
    });
  });
}
