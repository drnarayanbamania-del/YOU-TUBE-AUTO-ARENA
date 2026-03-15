import {
  ensureApiKey,
  parseQueryValue,
  runHandler,
  sendJson,
  youtubeFetch,
} from "../_lib/youtubeProxy.js";

export default async function handler(req, res) {
  await runHandler(req, res, async () => {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = ensureApiKey(res);
    if (!apiKey) return;

    const regionCode = parseQueryValue(req.query.regionCode, "US");
    const videoCategoryId = parseQueryValue(req.query.videoCategoryId, "28");
    const maxResults = parseQueryValue(req.query.maxResults, "10");

    const data = await youtubeFetch(
      "videos",
      {
        part: "snippet,statistics,contentDetails",
        chart: "mostPopular",
        regionCode,
        videoCategoryId: videoCategoryId === "0" ? undefined : videoCategoryId,
        maxResults,
      },
      apiKey,
    );

    sendJson(res, 200, data);
  });
}
