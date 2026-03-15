import { ensureSarvamKey, runSarvamHandler, sarvamTtsRequest, sendSarvamJson } from "../_lib/sarvamProxy.js";

function normalizeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export default async function handler(req, res) {
  await runSarvamHandler(req, res, async () => {
    if (req.method !== "POST") {
      sendSarvamJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = ensureSarvamKey(res);
    if (!apiKey) return;

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const text = normalizeText(body.text);
    const languageCode = normalizeText(body.languageCode, "hi-IN");
    const speaker = normalizeText(body.speaker, "meera");
    const model = normalizeText(body.model, "bulbul:v2");
    const title = normalizeText(body.title, "Hindi Voiceover");

    if (!text) {
      sendSarvamJson(res, 400, { error: "Missing text for TTS" });
      return;
    }

    const payload = await sarvamTtsRequest({
      apiKey,
      text,
      languageCode,
      speaker,
      model,
    });

    sendSarvamJson(res, 200, {
      ok: true,
      provider: payload.provider,
      mode: "server-proxy",
      title,
      mimeType: payload.mimeType,
      audioBase64: payload.audioBase64,
      model: payload.model,
      speaker: payload.speaker,
      languageCode: payload.languageCode,
      sampleRate: payload.sampleRate,
      apiBaseUrl: payload.apiBaseUrl,
    });
  });
}
