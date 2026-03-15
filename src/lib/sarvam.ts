export type SarvamHealth = {
  ok?: boolean;
  keyConfigured?: boolean;
  mode?: string;
  provider?: string;
  model?: string;
  speaker?: string;
  languageCode?: string;
  sampleRate?: number;
  apiBaseUrl?: string;
};

export type SarvamTtsResponse = {
  ok: true;
  provider: string;
  mode: string;
  title: string;
  mimeType: string;
  audioBase64: string;
  model: string;
  speaker: string;
  languageCode: string;
  sampleRate?: number;
  apiBaseUrl?: string;
};

function normalizeBase(base?: string) {
  return (base?.trim() || "/").replace(/\/$/, "");
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function fetchSarvamHealth(proxyBaseUrl?: string) {
  const base = normalizeBase(proxyBaseUrl);
  const response = await fetch(`${base}/api/sarvam/health`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Sarvam health failed with ${response.status}`);
  }
  return data as SarvamHealth;
}

export async function generateSarvamVoice(options: {
  text: string;
  title?: string;
  languageCode?: string;
  speaker?: string;
  model?: string;
  proxyBaseUrl?: string;
}) {
  const base = normalizeBase(options.proxyBaseUrl);
  const response = await fetch(`${base}/api/sarvam/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: options.text,
      title: options.title,
      languageCode: options.languageCode || "hi-IN",
      speaker: options.speaker || "meera",
      model: options.model || "bulbul:v2",
    }),
  });

  const data = (await response.json()) as SarvamTtsResponse | { error?: string };

  if (!response.ok || !(data as SarvamTtsResponse).audioBase64) {
    throw new Error((data as { error?: string })?.error || `Sarvam TTS failed with ${response.status}`);
  }

  const typed = data as SarvamTtsResponse;
  const blob = base64ToBlob(typed.audioBase64, typed.mimeType || "audio/wav");
  const audioUrl = URL.createObjectURL(blob);

  return {
    ...typed,
    blob,
    audioUrl,
  };
}
