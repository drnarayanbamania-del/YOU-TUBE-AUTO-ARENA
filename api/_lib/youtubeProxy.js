const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export function getApiKey() {
  return process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || "";
}

export function withCors(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleOptions(req, res) {
  withCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

export function ensureApiKey(res) {
  const apiKey = getApiKey();
  if (!apiKey) {
    withCors(res);
    res.status(500).json({ error: "Missing YOUTUBE_API_KEY on server" });
    return null;
  }
  return apiKey;
}

export async function youtubeFetch(path, params, apiKey) {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || `YouTube API failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function parseQueryValue(value, fallback) {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function sendJson(res, status, payload) {
  withCors(res);
  res.status(status).json(payload);
}

export async function runHandler(req, res, executor) {
  if (handleOptions(req, res)) return;

  try {
    await executor();
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}
