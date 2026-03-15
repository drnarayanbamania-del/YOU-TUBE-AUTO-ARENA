export type RunwayTaskStatus = {
  ok: boolean;
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  progress?: number;
  videoUrl?: string;
  error?: string;
};

function normalizeBase(base?: string) {
  return (base?.trim() || "/").replace(/\/$/, "");
}

export async function generateRunwayVideo(options: {
  promptText: string;
  model?: string;
  proxyBaseUrl?: string;
}) {
  const base = normalizeBase(options.proxyBaseUrl);
  const response = await fetch(`${base}/api/runway/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      promptText: options.promptText,
      model: options.model || "gen3a_turbo",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Runway generation failed with ${response.status}`);
  }

  return data as { ok: true; taskId: string; status: string };
}

export async function pollRunwayTask(taskId: string, proxyBaseUrl?: string): Promise<RunwayTaskStatus> {
  const base = normalizeBase(proxyBaseUrl);
  const response = await fetch(`${base}/api/runway/status?id=${taskId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `Runway status check failed with ${response.status}`);
  }

  return data as RunwayTaskStatus;
}
