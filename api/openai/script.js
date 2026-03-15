import { ensureOpenAiKey, openAiJsonRequest, runHandler, sendJson } from "../_lib/openaiProxy.js";

function normalizeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export default async function handler(req, res) {
  await runHandler(req, res, async () => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const apiKey = ensureOpenAiKey(res);
    if (!apiKey) return;

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const topic = body.topic || {};
    const brandName = normalizeText(body.brandName, "bamania auto forge AI");
    const language = normalizeText(body.language, "Hindi");

    const topicTitle = normalizeText(topic.title, "AI automation topic");
    const angle = normalizeText(topic.angle, "Create a high-retention cinematic short.");
    const notes = normalizeText(topic.notes, "");
    const keywords = Array.isArray(topic.keywords) ? topic.keywords.filter((value) => typeof value === "string").slice(0, 6) : [];

    const input = [
      {
        role: "system",
        content: "You are an expert cinematic short-form scriptwriter. Return valid JSON only. Write in Hindi only using natural, modern creator-friendly Hindi. Create concise but high-retention lines for a cinematic still-image video. Avoid English sentences except unavoidable brand/product names or hashtags.",
      },
      {
        role: "user",
        content: `Create a Hindi-only cinematic storyboard for this topic.\n\nBrand: ${brandName}\nLanguage: ${language}\nTopic title: ${topicTitle}\nAngle: ${angle}\nKeywords: ${keywords.join(", ")}\nNotes: ${notes}\n\nRequirements:\n- 4 to 6 scenes\n- Focus on cinematic image-video output only\n- Keep each scene visually strong and emotionally sharp\n- Include a hook, title, CTA, caption, hashtags, and scene prompts\n- Each scene title should be short\n- Each narration should be 1-2 lines in Hindi\n- Each caption should be short for on-screen text\n- Each visualPrompt should describe a cinematic still frame in 9:16 vertical format`,
      },
    ];


    const payload = await openAiJsonRequest({
      apiKey,
      model: "gpt-4o-mini",
      input,
      temperature: 0.8,
    });


    sendJson(res, 200, { ok: true, data: payload, provider: "openai", mode: "server-proxy" });
  });
}
