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
    const maxResults = parseQueryValue(req.query.maxResults, "10");
    const regionCode = parseQueryValue(req.query.regionCode, "US");
    const relevanceLanguage = parseQueryValue(req.query.relevanceLanguage, "en");
    const videoCategoryId = parseQueryValue(req.query.videoCategoryId, "28");
    const publishedAfter = parseQueryValue(req.query.publishedAfter, undefined);

    const searchData = await youtubeFetch(
      "search",
      {
        part: "snippet",
        type: "video",
        order: "viewCount",
        q,
        maxResults,
        regionCode,
        relevanceLanguage,
        videoCategoryId: videoCategoryId === "0" ? undefined : videoCategoryId,
        publishedAfter,
        safeSearch: "moderate",
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
