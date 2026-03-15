function withCors(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Runway-Version");
}

function handleOptions(req, res) {
  withCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

export function getRunwayKey() {
  return process.env.RUNWAY_API_KEY || "";
}

export function ensureRunwayKey(res) {
  const apiKey = getRunwayKey();
  if (!apiKey) {
    withCors(res);
    res.status(500).json({ error: "Missing RUNWAY_API_KEY on server" });
    return null;
  }
  return apiKey;
}

export function sendRunwayJson(res, status, payload) {
  withCors(res);
  res.status(status).json(payload);
}

export async function runRunwayHandler(req, res, executor) {
  if (handleOptions(req, res)) return;

  try {
    await executor();
  } catch (error) {
    sendRunwayJson(res, 500, {
      error: error instanceof Error ? error.message : "Unknown Runway proxy error",
    });
  }
}

export async function runwayRequest({ apiKey, method, endpoint, body }) {
  const response = await fetch(`https://api.runwayml.com/v1${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": "2024-11-06",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Runway API failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}
