export type OpenAiStoryboardTopic = {
  title: string;
  angle?: string;
  notes?: string;
  keywords?: string[];
};

export type OpenAiStoryboardScene = {
  title: string;
  narration: string;
  caption: string;
  visualPrompt: string;
};

export type OpenAiStoryboardResponse = {
  scriptTitle: string;
  hook: string;
  callToAction: string;
  caption: string;
  hashtags: string[];
  scenes: OpenAiStoryboardScene[];
};

export async function generateHindiStoryboard(options: {
  topic: OpenAiStoryboardTopic;
  brandName: string;
  language?: string;
  proxyBaseUrl?: string;
}) {
  const base = options.proxyBaseUrl?.trim() || "/";
  const response = await fetch(`${base.replace(/\/$/, "")}/api/openai/script`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: options.topic,
      brandName: options.brandName,
      language: options.language || "Hindi",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `OpenAI script API failed with ${response.status}`);
  }

  return data as { ok: true; data: OpenAiStoryboardResponse; provider: string; mode: string };
}
