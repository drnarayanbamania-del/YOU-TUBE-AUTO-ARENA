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

    const channelId = parseQueryValue(req.query.channelId, "");
    const maxResults = parseQueryValue(req.query.maxResults, "8");
    const regionCode = parseQueryValue(req.query.regionCode, "US");

    if (!channelId) {
      sendJson(res, 400, { error: "Missing channelId" });
      return;
    }

    const searchData = await youtubeFetch(
      "search",
      {
        part: "snippet",
        type: "video",
        order: "date",
        channelId,
        maxResults,
        regionCode,
      },
      apiKey,
    );

    const ids = Array.from(new Set((searchData.items || []).map((item) => item?.id?.videoId).filter(Boolean)));

    if (!ids.length) {
      sendJson(res, 200, { items: [] });
      return;
    }

    const videos = await youtubeFetch(
      "videos",
      {
        part: "snippet,statistics,contentDetails",
        id: ids.join(","),
      },
      apiKey,
    );

    sendJson(res, 200, videos);
  });
}
