function withCors(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function handleOptions(req, res) {
  withCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

export function getSarvamKey() {
  return process.env.SARVAM_API_KEY || "";
}

function normalizeUrl(value, fallback) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).replace(/\/$/, "");
}

function normalizeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function getSarvamConfig() {
  return {
    apiBaseUrl: normalizeUrl(process.env.SARVAM_API_BASE_URL, "https://api.sarvam.ai"),
    model: (process.env.SARVAM_TTS_MODEL || "bulbul:v2").trim() || "bulbul:v2",
    speaker: (process.env.SARVAM_TTS_SPEAKER || "meera").trim() || "meera",
    languageCode: (process.env.SARVAM_LANGUAGE_CODE || "hi-IN").trim() || "hi-IN",
    sampleRate: normalizeNumber(process.env.SARVAM_SAMPLE_RATE, 22050),
  };
}

export function ensureSarvamKey(res) {
  const apiKey = getSarvamKey();
  if (!apiKey) {
    withCors(res);
    res.status(500).json({ error: "Missing SARVAM_API_KEY on server" });
    return null;
  }
  return apiKey;
}

export function sendSarvamJson(res, status, payload) {
  withCors(res);
  res.status(status).json(payload);
}

export async function runSarvamHandler(req, res, executor) {
  if (handleOptions(req, res)) return;

  try {
    await executor();
  } catch (error) {
    sendSarvamJson(res, 500, {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}

function normalizeBase64Audio(value) {
  if (!value || typeof value !== "string") return null;
  return value.trim() || null;
}

export async function sarvamTtsRequest({ apiKey, text, languageCode, speaker, model, sampleRate }) {
  const config = getSarvamConfig();
  const resolvedLanguageCode = languageCode || config.languageCode;
  const resolvedSpeaker = speaker || config.speaker;
  const resolvedModel = model || config.model;
  const resolvedSampleRate = normalizeNumber(sampleRate, config.sampleRate);

  const response = await fetch(`${config.apiBaseUrl}/text-to-speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: resolvedLanguageCode,
      speaker: resolvedSpeaker,
      model: resolvedModel,
      pace: 1,
      loudness: 1,
      speech_sample_rate: resolvedSampleRate,
      enable_preprocessing: true,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Sarvam API failed with ${response.status}`;
    throw new Error(message);
  }

  const audioBase64 =
    normalizeBase64Audio(data?.audios?.[0]) ||
    normalizeBase64Audio(data?.audio?.[0]) ||
    normalizeBase64Audio(data?.audio) ||
    normalizeBase64Audio(data?.output?.audio);

  if (!audioBase64) {
    throw new Error("Sarvam returned no audio payload");
  }

  return {
    audioBase64,
    mimeType: "audio/wav",
    provider: "sarvam",
    model: resolvedModel,
    speaker: resolvedSpeaker,
    languageCode: resolvedLanguageCode,
    sampleRate: resolvedSampleRate,
    apiBaseUrl: config.apiBaseUrl,
  };
}
