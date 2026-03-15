import { getSarvamConfig, getSarvamKey, runSarvamHandler, sendSarvamJson } from "../_lib/sarvamProxy.js";

export default async function handler(req, res) {
  await runSarvamHandler(req, res, async () => {
    if (req.method !== "GET") {
      sendSarvamJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = getSarvamKey();
    const config = getSarvamConfig();
    sendSarvamJson(res, 200, {
      ok: Boolean(apiKey),
      keyConfigured: Boolean(apiKey),
      mode: "server-proxy",
      provider: "sarvam",
      model: config.model,
      speaker: config.speaker,
      languageCode: config.languageCode,
      sampleRate: config.sampleRate,
      apiBaseUrl: config.apiBaseUrl,
    });
  });
}
