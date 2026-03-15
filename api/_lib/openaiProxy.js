export function withCors(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
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

export function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || "";
}

export function ensureOpenAiKey(res) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    withCors(res);
    res.status(500).json({ error: "Missing OPENAI_API_KEY on server" });
    return null;
  }
  return apiKey;
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

export async function openAiJsonRequest({ apiKey, model = "gpt-4o-mini", input, temperature = 0.7 }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: input, // 'input' is already formatted as messages in script.js
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cinematic_storyboard",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              scriptTitle: { type: "string" },
              hook: { type: "string" },
              callToAction: { type: "string" },
              caption: { type: "string" },
              hashtags: {
                type: "array",
                items: { type: "string" },
              },
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    narration: { type: "string" },
                    caption: { type: "string" },
                    visualPrompt: { type: "string" },
                  },
                  required: ["title", "narration", "caption", "visualPrompt"],
                },
              },
            },
            required: ["scriptTitle", "hook", "callToAction", "caption", "hashtags", "scenes"],
          },
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || `OpenAI API failed with ${response.status}`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no content in message");
  }

  return JSON.parse(content);
}

