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

    const q = parseQueryValue(req.query.q, "AI automation");
    const maxResults = parseQueryValue(req.query.maxResults, "8");
    const regionCode = parseQueryValue(req.query.regionCode, "US");

    const searchData = await youtubeFetch(
      "search",
      {
        part: "snippet",
        type: "channel",
        q,
        maxResults,
        regionCode,
      },
      apiKey,
    );

    const channelIds = Array.from(new Set((searchData.items || []).map((item) => item?.id?.channelId).filter(Boolean)));

    if (!channelIds.length) {
      sendJson(res, 200, { items: [] });
      return;
    }

    const channels = await youtubeFetch(
      "channels",
      {
        part: "snippet,statistics,brandingSettings",
        id: channelIds.join(","),
      },
      apiKey,
    );

    sendJson(res, 200, channels);
  });
}
