import { useEffect, useMemo, useState } from "react";
import {
  fetchYouTubeChannelVideos,
  fetchYouTubeChannels,
  fetchYouTubeProxyHealth,
  fetchYouTubeTrendSeeds,
  fetchYouTubeTrendingTopicSeeds,
  type FetchMode,
  type YouTubeChannel,
  type YouTubeVideo,
  youtubeCategories,
  youtubeRegions,
} from "./lib/youtube";
import { generateHindiStoryboard } from "./lib/openai";
import { fetchSarvamHealth, generateSarvamVoice } from "./lib/sarvam";

type AppPage = "dashboard" | "flow" | "generator" | "studio" | "library" | "analytics" | "settings" | "verify";
type PlatformKey = "instagram" | "youtube" | "facebook";
type PlatformLabel = "Instagram Reels" | "YouTube Shorts" | "Facebook Pages";
type SettingsTab = "Social Accounts" | "API Credentials" | "Security & Auth" | "Storage Settings";
type JobStatus = "scheduled" | "published" | "failed";
type ProjectStatus = "draft" | "video-ready" | "scheduled" | "published";
type FlowTab = "User Flow" | "Automation Flow";

type Topic = {
  id: string;
  title: string;
  source: "YouTube" | "News" | "Social";
  freshness: number;
  velocity: number;
  commercial: number;
  keywords: string[];
  angle: string;
  notes: string;
  score: number;
  videoId?: string;
  channelId?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  duration?: string;
  regionCode?: string;
  categoryId?: string;
};

type Scene = {
  id: string;
  title: string;
  narration: string;
  caption: string;
  visualPrompt: string;
  imageUrl: string;
  background: string;
  accent: string;
};

type Project = {
  id: string;
  createdAt: string;
  topic: Topic;
  scriptTitle: string;
  hook: string;
  callToAction: string;
  script: string;
  caption: string;
  hashtags: string[];
  scenes: Scene[];
  voiceText?: string;
  voiceAudioUrl?: string;
  voiceMimeType?: string;
  videoUrl?: string;
  videoMimeType?: string;
  fallbackVideoUrl?: string;
  fallbackVideoMimeType?: string;
  fallbackVideoLabel?: string;
  status: ProjectStatus;
  exports: {
    script: boolean;
    scenePack: boolean;
    video: boolean;
    voice: boolean;
  };
};

type PublishJob = {
  id: string;
  projectId: string;
  platform: PlatformLabel;
  scheduledFor: string;
  status: JobStatus;
  attempts: number;
  error?: string;
};

type UserSession = {
  email: string;
  workspace: string;
};

type Settings = {
  systemActive: boolean;
  brandName: string;
  motionPace: number;
  videoLengthMultiplier: number;
  defaultPlatform: PlatformLabel;
  voice: {
    enabled: boolean;
    language: "hi-IN";
    rate: number;
    pitch: number;
    selectedVoiceURI: string;
    includeInVideo: boolean;
  };
  apiKeys: {
    llm: string;
    image: string;
    storage: string;
    youtube: string;
  };
  security: {
    workspace: string;
    authMode: "Passwordless Link" | "Workspace Password" | "SSO";
    require2FA: boolean;
  };
  storage: {
    provider: "Local Browser Vault" | "Amazon S3" | "Cloudflare R2";
    retention: "7 days" | "30 days" | "90 days";
    folder: string;
  };
  integrations: {
    youtubeMode: FetchMode;
    proxyBaseUrl: string;
    regionCode: string;
    categoryId: string;
    relevanceLanguage: string;
  };
  socialAccounts: Record<PlatformKey, boolean>;
};

type Metric = { label: string; value: string; tone?: "default" | "success" | "warn" };

const STORAGE_KEYS = {
  settings: "autoforge-settings-v3",
  session: "autoforge-session-v3",
  projects: "autoforge-projects-v3",
  jobs: "autoforge-jobs-v3",
};

const platformLabels: Record<PlatformKey, PlatformLabel> = {
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
  facebook: "Facebook Pages",
};

const pageLabels: Record<AppPage, string> = {
  dashboard: "Dashboard",
  flow: "Flow",
  generator: "Generator",
  studio: "Studio",
  library: "Library",
  analytics: "Analytics",
  settings: "Settings",
  verify: "Verify",
};

const pageRoutes: Record<AppPage, string> = {
  dashboard: "/",
  flow: "/flow",
  generator: "/generator",
  studio: "/studio",
  library: "/library",
  analytics: "/analytics",
  settings: "/settings",
  verify: "/verify",
};

const pageDescriptions: Record<AppPage, string> = {
  dashboard: "Operational overview, readiness score, and quick actions.",
  flow: "Clickable user flow and automation flow that guides the journey from setup to publish.",
  generator: "Discover live topics, YouTube channels, and trend-backed content ideas.",
  studio: "Generate Hindi cinematic scripts, scene packs, and vertical video exports.",
  library: "Manage projects, exported assets, and local publishing history.",
  analytics: "Monitor throughput, queue health, and production signals.",
  settings: "Configure integrations, API credentials, auth, and storage.",
  verify: "Review MVP status, architecture coverage, and deployment readiness.",
};

const settingsTabs = [
  {
    title: "Social Accounts",
    description: "Connect publishing destinations and choose the default release target for the automation pipeline.",
    highlights: ["Platform connection toggles", "Default publish destination", "Release readiness status"],
  },
  {
    title: "API Credentials",
    description: "Manage your AI orchestration keys and environment preferences.",
    highlights: ["LLM key slot", "Image provider slot", "YouTube collector credentials"],
  },
  {
    title: "Security & Auth",
    description: "Configure workspace identity, access policy, and sign-in expectations.",
    highlights: ["Workspace name", "Authentication mode", "2FA policy"],
  },
  {
    title: "Storage Settings",
    description: "Control where scripts, scene packs, and exported videos are staged.",
    highlights: ["Storage provider", "Retention policy", "Export folder name"],
  },
] as const;

const topicSeeds: Omit<Topic, "id" | "score">[] = [
  {
    title: "AI employees replacing repetitive back-office tasks",
    source: "YouTube",
    freshness: 90,
    velocity: 95,
    commercial: 88,
    keywords: ["AI agents", "operations", "automation", "productivity"],
    angle: "Show how startups are using AI workers to scale without increasing repetitive manual work.",
    notes: "Strong B2B SaaS appeal with excellent short-form storytelling potential.",
  },
  {
    title: "One-person content businesses powered by AI toolchains",
    source: "Social",
    freshness: 82,
    velocity: 92,
    commercial: 91,
    keywords: ["creator economy", "AI content", "solopreneur", "growth"],
    angle: "Break down how solo founders publish with agency-level output using automation.",
    notes: "Excellent founder and creator audience fit.",
  },
  {
    title: "AI video workflows turning ideas into short-form cinematic clips",
    source: "News",
    freshness: 84,
    velocity: 88,
    commercial: 89,
    keywords: ["video automation", "shorts", "repurposing", "creator ops"],
    angle: "Demonstrate a repeatable pipeline that transforms a single idea into daily cinematic content.",
    notes: "Directly aligned with the product story of this MVP.",
  },
  {
    title: "Automated trend scraping for creator research teams",
    source: "Social",
    freshness: 77,
    velocity: 80,
    commercial: 84,
    keywords: ["trend mining", "scraping", "creator research", "data"],
    angle: "Explain why fast creators win by operationalizing trend discovery instead of guessing.",
    notes: "Works well as educational and framework content.",
  },
  {
    title: "AI startup stacks combining FastAPI, queues, and browser agents",
    source: "News",
    freshness: 81,
    velocity: 87,
    commercial: 90,
    keywords: ["FastAPI", "workers", "queues", "browser automation"],
    angle: "Show the technical architecture behind resilient AI automation products.",
    notes: "High-authority content for founders and operators.",
  },
  {
    title: "How cinematic vertical storytelling boosts short-form watch time",
    source: "YouTube",
    freshness: 78,
    velocity: 85,
    commercial: 76,
    keywords: ["cinematic", "vertical video", "watch time", "retention"],
    angle: "Connect visual structure, pacing, and hook design to audience retention.",
    notes: "Perfect for image-based video demos.",
  },
];

const defaultSettings: Settings = {
  systemActive: true,
  brandName: "bamania auto forge AI",
  motionPace: 1,
  videoLengthMultiplier: 1,
  defaultPlatform: "YouTube Shorts",
  voice: {
    enabled: true,
    language: "hi-IN",
    rate: 0.95,
    pitch: 1,
    selectedVoiceURI: "",
    includeInVideo: false,
  },
  apiKeys: {
    llm: "demo-llm-key",
    image: "demo-image-key",
    storage: "demo-storage-key",
    youtube: "",
  },
  security: {
    workspace: "bamania auto forge AI Workspace",
    authMode: "Passwordless Link",
    require2FA: true,
  },
  storage: {
    provider: "Local Browser Vault",
    retention: "30 days",
    folder: "bamania-auto-forge-exports",
  },
  integrations: {
    youtubeMode: "server-proxy",
    proxyBaseUrl: "/",
    regionCode: "IN",
    categoryId: "28",
    relevanceLanguage: "hi",
  },
  socialAccounts: {
    instagram: false,
    youtube: false,
    facebook: false,
  },
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatNumber(value?: number) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maskKey(value: string) {
  if (!value.trim()) return "Not configured";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

function platformToKey(platform: PlatformLabel): PlatformKey {
  if (platform === "Instagram Reels") return "instagram";
  if (platform === "Facebook Pages") return "facebook";
  return "youtube";
}

function getDefaultScheduleTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeRoutePath(path: string) {
  return path.trim().toLowerCase().replace(/\/+$/, "") || "/";
}

function toLocationPage(locationLike: Pick<Location, "pathname" | "hash">): AppPage {
  const hashPath = normalizeRoutePath(locationLike.hash.replace(/^#/, ""));
  const pathPath = normalizeRoutePath(locationLike.pathname);
  const target = hashPath !== "/" ? hashPath : pathPath;
  const match = (Object.entries(pageRoutes) as Array<[AppPage, string]>).find(([, route]) => route === target);
  return match?.[0] ?? "dashboard";
}

function routeHref(page: AppPage) {
  return `#${pageRoutes[page]}`;
}

const VIDEO_LENGTH_MIN = 1;
const VIDEO_LENGTH_MAX = 15;

function normalizeSettings(input: Partial<Settings> | null | undefined): Settings {
  return {
    ...defaultSettings,
    ...input,
    voice: {
      ...defaultSettings.voice,
      ...(input?.voice ?? {}),
    },
    apiKeys: {
      ...defaultSettings.apiKeys,
      ...(input?.apiKeys ?? {}),
    },
    security: {
      ...defaultSettings.security,
      ...(input?.security ?? {}),
    },
    storage: {
      ...defaultSettings.storage,
      ...(input?.storage ?? {}),
    },
    integrations: {
      ...defaultSettings.integrations,
      ...(input?.integrations ?? {}),
    },
    socialAccounts: {
      ...defaultSettings.socialAccounts,
      ...(input?.socialAccounts ?? {}),
    },
  };
}

function rankTopics(seedList: Omit<Topic, "id" | "score">[], systemActive: boolean) {
  return seedList
    .map((topic) => {
      const score = Math.round(topic.freshness * 0.34 + topic.velocity * 0.38 + topic.commercial * 0.28 + (systemActive ? 4 : 0));
      return {
        ...topic,
        id: uid("topic"),
        score: clamp(score, 1, 100),
      } satisfies Topic;
    })
    .sort((a, b) => b.score - a.score);
}

function buildDynamicTopics(query: string): Omit<Topic, "id" | "score">[] {
  const clean = query.trim();
  if (!clean) return [];
  return [
    {
      title: `${clean} के लिए cinematic short workflow`,
      source: "Social",
      freshness: 80,
      velocity: 83,
      commercial: 85,
      keywords: clean.toLowerCase().split(/\s+/).slice(0, 4),
      angle: `${clean} को cinematic image video pipeline के रूप में प्रस्तुत करें और इसे practical automation system से जोड़ें।`,
      notes: "User-seeded niche topic from the collector input.",
    },
    {
      title: `${clean} trend breakdown for creators`,
      source: "News",
      freshness: 76,
      velocity: 78,
      commercial: 82,
      keywords: [clean, "creator", "trend"],
      angle: `${clean} trend को founder/creator audience के लिए clear framework में explain करें।`,
      notes: "Dynamic ranking topic generated from the current collector query.",
    },
  ];
}

function videoToTopic(video: YouTubeVideo, query: string): Omit<Topic, "id" | "score"> {
  const freshness = clamp(96 - Math.floor((Date.now() - new Date(video.publishedAt).getTime()) / (1000 * 60 * 60 * 10)), 56, 98);
  const velocity = clamp(Math.round(50 + Math.log10(Math.max(video.viewCount, 1)) * 14), 52, 99);
  const commercial = clamp(60 + (video.title.toLowerCase().includes("ai") ? 16 : 10), 55, 94);
  const keywords = Array.from(
    new Set(
      `${video.title} ${query}`
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.replace(/[^a-z0-9\u0900-\u097f]/g, ""))
        .filter((word) => word.length > 2),
    ),
  ).slice(0, 6);

  return {
    title: video.title,
    source: "YouTube",
    freshness,
    velocity,
    commercial,
    keywords,
    angle: `${video.channelTitle} की live performance को use करके ${query || video.title} के लिए high-retention cinematic short बनाएँ।`,
    notes: `Live YouTube topic from ${video.channelTitle}. Views ${formatNumber(video.viewCount)}, likes ${formatNumber(video.likeCount)}, comments ${formatNumber(video.commentCount)}.`,
    videoId: video.id,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    duration: video.duration,
    regionCode: video.regionCode,
    categoryId: video.categoryId,
  };
}

function createSceneImage(scene: Pick<Scene, "title" | "caption" | "background" | "accent">, brandName: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${scene.background}"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.42)"/>
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="32"/></filter>
      </defs>
      <rect width="720" height="1280" fill="url(#bg)"/>
      <rect y="0" width="720" height="86" fill="#000" opacity="0.9"/>
      <rect y="1194" width="720" height="86" fill="#000" opacity="0.9"/>
      <circle cx="570" cy="320" r="220" fill="${scene.accent}" opacity="0.26" filter="url(#blur)"/>
      <circle cx="150" cy="860" r="180" fill="#38bdf8" opacity="0.18" filter="url(#blur)"/>
      <rect x="56" y="162" width="608" height="956" rx="36" fill="rgba(7,10,22,0.26)" stroke="rgba(255,255,255,0.15)"/>
      <rect x="84" y="198" width="552" height="642" rx="28" fill="url(#overlay)" stroke="rgba(255,255,255,0.1)"/>
      <rect x="84" y="198" width="552" height="642" rx="28" fill="none" stroke="rgba(255,255,255,0.12)"/>
      <text x="104" y="252" font-family="Arial, sans-serif" font-size="22" fill="${scene.accent}" opacity="0.95" letter-spacing="4">CINEMATIC FRAME</text>
      <text x="104" y="894" font-family="Arial, sans-serif" font-size="18" fill="#cbd5e1" letter-spacing="3">${brandName.toUpperCase()}</text>
      <text x="104" y="964" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#ffffff">${escapeXml(scene.title)}</text>
      <foreignObject x="104" y="996" width="520" height="120">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:28px;line-height:1.45;color:#e2e8f0;">
          ${escapeXml(scene.caption)}
        </div>
      </foreignObject>
      <text x="104" y="1146" font-family="Arial, sans-serif" font-size="18" fill="#94a3b8">9:16 vertical image-video export ready</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateProject(topic: Topic, settings: Settings): Project {
  const safeTitle = topic.title;
  const keywords = topic.keywords.slice(0, 4);
  const scriptTitle = `${safeTitle}: cinematic short strategy जिसे smart creators अभी use कर रहे हैं`;
  const hook = `अगर आप ${safeTitle} जैसे trend को सिर्फ़ देख नहीं बल्कि तेज़ी से cinematic short में बदलना चाहते हैं, तो यह automation workflow आपके लिए है।`;
  const callToAction = `ऐसे और cinematic AI workflows के लिए ${settings.brandName} को follow करें और इस framework को अपने content engine में save करें।`;
  const caption = `${safeTitle} को cinematic image video pipeline में बदलने का practical तरीका।`;
  const hashtags = ["#AIContent", "#ShortsStrategy", "#CinematicVideo", "#Automation", "#HindiCreators"];

  const scenesBase = [
    {
      title: "Trend Signal",
      caption: `यह trend अभी attention capture कर रहा है क्योंकि इसमें ${keywords[0] ?? "AI"} और audience curiosity दोनों strong हैं।`,
      narration: `सबसे पहले trend signal को isolate किया जाता है ताकि content random न लगे बल्कि timely और relevant लगे।`,
      visualPrompt: `cinematic newsroom, trend intelligence dashboard, dramatic contrast, premium 9:16 frame`,
      background: "#0f172a",
      accent: "#38bdf8",
    },
    {
      title: "Story Angle",
      caption: `${safeTitle} को simple news की तरह नहीं, बल्कि clear transformation story की तरह frame किया जाता है।`,
      narration: `दूसरे चरण में angle तय होता है ताकि वीडियो सिर्फ़ जानकारी न दे, बल्कि audience को outcome imagine करने दे।`,
      visualPrompt: `cinematic storyboard wall, creator planning frame, moody light, vertical film composition`,
      background: "#111827",
      accent: "#22d3ee",
    },
    {
      title: "Visual Build",
      caption: `हर scene को still-image cinematic frame में convert किया जाता है ताकि video premium लगे even बिना complex footage के।`,
      narration: `तीसरे चरण में still visuals, bold typography, and pace-driven transitions use करके image video तैयार किया जाता है।`,
      visualPrompt: `luxury cinematic still image, dramatic lighting, digital creator studio, premium overlays`,
      background: "#1e1b4b",
      accent: "#a78bfa",
    },
    {
      title: "Publishing Loop",
      caption: `अंत में यह asset scheduler, platform queue और library के साथ repeatable growth loop बनाता है।`,
      narration: `यही automation loop एक idea को repeatable publishing system में बदल देता है।`,
      visualPrompt: `cinematic control room, publishing queue, premium UI, dramatic perspective, 9:16 short film frame`,
      background: "#172554",
      accent: "#f472b6",
    },
  ];

  const scenes: Scene[] = scenesBase.map((scene, index) => ({
    id: uid(`scene-${index + 1}`),
    ...scene,
    imageUrl: createSceneImage(scene, settings.brandName),
  }));

  const script = [
    `Hook: ${hook}`,
    "",
    ...scenes.map(
      (scene, index) =>
        `सीन ${index + 1} — ${scene.title}\n${scene.narration}\nOn-screen: ${scene.caption}`,
    ),
    "",
    `CTA: ${callToAction}`,
  ].join("\n\n");

  return {
    id: uid("project"),
    createdAt: new Date().toISOString(),
    topic,
    scriptTitle,
    hook,
    callToAction,
    script,
    caption,
    hashtags,
    scenes,
    voiceText: scenes.map((scene) => scene.narration).join(" "),
    videoUrl: undefined,
    videoMimeType: undefined,
    fallbackVideoUrl: undefined,
    fallbackVideoMimeType: undefined,
    fallbackVideoLabel: undefined,
    status: "draft",
    exports: {
      script: true,
      scenePack: true,
      video: false,
      voice: false,
    },
  };
}

function buildProjectFromAiStoryboard(
  topic: Topic,
  settings: Settings,
  storyboard: {
    scriptTitle: string;
    hook: string;
    callToAction: string;
    caption: string;
    hashtags: string[];
    scenes: Array<{
      title: string;
      narration: string;
      caption: string;
      visualPrompt: string;
    }>;
  },
): Project {
  const palette = [
    { background: "#0f172a", accent: "#38bdf8" },
    { background: "#111827", accent: "#22d3ee" },
    { background: "#1e1b4b", accent: "#a78bfa" },
    { background: "#172554", accent: "#f472b6" },
    { background: "#0f172a", accent: "#f59e0b" },
    { background: "#111827", accent: "#34d399" },
  ];

  const scenes: Scene[] = storyboard.scenes.map((scene, index) => {
    const paletteItem = palette[index % palette.length];
    const sceneData = {
      title: scene.title,
      caption: scene.caption,
      background: paletteItem.background,
      accent: paletteItem.accent,
    };

    return {
      id: uid(`scene-${index + 1}`),
      title: scene.title,
      narration: scene.narration,
      caption: scene.caption,
      visualPrompt: scene.visualPrompt,
      background: paletteItem.background,
      accent: paletteItem.accent,
      imageUrl: createSceneImage(sceneData, settings.brandName),
    };
  });

  const script = [
    `Hook: ${storyboard.hook}`,
    "",
    ...scenes.map((scene, index) => `सीन ${index + 1} — ${scene.title}\n${scene.narration}\nOn-screen: ${scene.caption}`),
    "",
    `CTA: ${storyboard.callToAction}`,
  ].join("\n\n");

  return {
    id: uid("project"),
    createdAt: new Date().toISOString(),
    topic,
    scriptTitle: storyboard.scriptTitle,
    hook: storyboard.hook,
    callToAction: storyboard.callToAction,
    script,
    caption: storyboard.caption,
    hashtags: storyboard.hashtags,
    scenes,
    voiceText: scenes.map((scene) => scene.narration).join(" "),
    videoUrl: undefined,
    videoMimeType: undefined,
    fallbackVideoUrl: undefined,
    fallbackVideoMimeType: undefined,
    fallbackVideoLabel: undefined,
    status: "draft",
    exports: {
      script: true,
      scenePack: true,
      video: false,
      voice: false,
    },
  };
}

function getRecorderMimeType() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function loadAudioElement(src: string) {
  return new Promise<HTMLAudioElement>((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "auto";
    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.oncanplaythrough = null;
      audio.onerror = null;
    };
    audio.onloadedmetadata = () => {
      cleanup();
      resolve(audio);
    };
    audio.oncanplaythrough = () => {
      cleanup();
      resolve(audio);
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Audio metadata unavailable"));
    };
    audio.src = src;
  });
}

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  image: HTMLImageElement,
  brandName: string,
  index: number,
  total: number,
  progress: number,
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, scene.background);
  gradient.addColorStop(1, "#020617");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const scale = 1.04 + progress * 0.08;
  const imgWidth = width * scale;
  const imgHeight = height * scale;
  const x = (width - imgWidth) / 2;
  const y = (height - imgHeight) / 2 - progress * 36;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(image, x, y, imgWidth, imgHeight);
  ctx.globalAlpha = 1;

  const overlay = ctx.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, "rgba(3,7,18,0.25)");
  overlay.addColorStop(0.65, "rgba(3,7,18,0.1)");
  overlay.addColorStop(1, "rgba(2,6,23,0.85)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(0,0,0,0.92)";
  ctx.fillRect(0, 0, width, 78);
  ctx.fillRect(0, height - 78, width, 78);

  ctx.fillStyle = scene.accent;
  ctx.font = "600 20px Inter, Arial, sans-serif";
  ctx.fillText("CINEMATIC IMAGE VIDEO", 48, 126);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px Inter, Arial, sans-serif";
  wrapCanvasText(ctx, scene.title, 48, 884, 620, 54);

  ctx.fillStyle = "rgba(226,232,240,0.92)";
  ctx.font = "500 28px Inter, Arial, sans-serif";
  wrapCanvasText(ctx, scene.caption, 48, 980, 620, 38);

  ctx.fillStyle = "rgba(148,163,184,0.95)";
  ctx.font = "500 18px Inter, Arial, sans-serif";
  ctx.fillText(`${brandName}  •  Scene ${index + 1}/${total}`, 48, 1144);
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let y = startY;
  for (let i = 0; i < words.length; i += 1) {
    const test = `${line}${words[i]} `;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, y);
      line = `${words[i]} `;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line.trim(), x, y);
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadUrl(filename: string, url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

function createFallbackVideoHtml(project: Project, brandName: string, sceneDurationSeconds: number) {
  const escapedTitle = project.scriptTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedBrand = brandName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const slides = project.scenes
    .map(
      (scene, index) => `
        <section class="slide" style="--accent:${scene.accent}; --bg:${scene.background}; --delay:${index * sceneDurationSeconds}s;">
          <img src="${scene.imageUrl}" alt="${scene.title.replace(/"/g, "&quot;")}" />
          <div class="overlay"></div>
          <div class="content">
            <p class="eyebrow">Cinematic image video</p>
            <h2>${scene.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h2>
            <p class="caption">${scene.caption.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            <div class="meta">${escapedBrand} • Scene ${index + 1}/${project.scenes.length}</div>
          </div>
        </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="hi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle} — fallback cinematic export</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      background: #020617;
      color: white;
      overflow: hidden;
    }
    .deck {
      position: relative;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at top, rgba(34,211,238,0.14), transparent 40%), #020617;
    }
    .slide {
      position: absolute;
      inset: 0;
      opacity: 0;
      animation: slideShow ${Math.max(project.scenes.length * sceneDurationSeconds, 1)}s linear infinite;
      animation-delay: var(--delay);
      background: linear-gradient(180deg, var(--bg), #020617);
    }
    .slide img {
      position: absolute;
      inset: -4%;
      width: 108%;
      height: 108%;
      object-fit: cover;
      opacity: 0.9;
      animation: kenburns ${sceneDurationSeconds}s ease-in-out infinite alternate;
    }
    .overlay {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(2,6,23,0.22) 0%, rgba(2,6,23,0.08) 40%, rgba(2,6,23,0.92) 100%),
        linear-gradient(90deg, rgba(0,0,0,0.58), transparent 58%);
    }
    .content {
      position: absolute;
      left: 6vw;
      right: 6vw;
      bottom: 9vh;
      z-index: 2;
      max-width: 42rem;
    }
    .eyebrow {
      margin: 0 0 1rem;
      text-transform: uppercase;
      letter-spacing: 0.35em;
      font-size: 0.72rem;
      color: var(--accent);
      font-weight: 700;
    }
    h2 {
      margin: 0;
      font-size: clamp(2rem, 5vw, 4rem);
      line-height: 1.05;
    }
    .caption {
      margin: 1rem 0 0;
      font-size: clamp(1rem, 2vw, 1.35rem);
      line-height: 1.7;
      color: rgba(226,232,240,0.94);
    }
    .meta {
      margin-top: 1.25rem;
      color: rgba(148,163,184,0.95);
      font-size: 0.95rem;
    }
    .film-bar {
      position: absolute;
      left: 0;
      width: 100%;
      height: 5vh;
      background: rgba(0,0,0,0.92);
      z-index: 3;
    }
    .film-bar.top { top: 0; }
    .film-bar.bottom { bottom: 0; }
    .control {
      position: absolute;
      top: 1rem;
      right: 1rem;
      z-index: 4;
      padding: 0.7rem 1rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(15,23,42,0.8);
      color: white;
      backdrop-filter: blur(16px);
    }
    @keyframes kenburns {
      from { transform: scale(1.02) translateY(0px); }
      to { transform: scale(1.1) translateY(-18px); }
    }
    @keyframes slideShow {
      0% { opacity: 0; }
      4% { opacity: 1; }
      28% { opacity: 1; }
      32% { opacity: 0; }
      100% { opacity: 0; }
    }
  </style>
</head>
<body>
  <div class="deck">
    <div class="film-bar top"></div>
    <div class="film-bar bottom"></div>
    <button class="control" onclick="document.documentElement.requestFullscreen?.()">Fullscreen</button>
    ${slides}
  </div>
</body>
</html>`;
}

function createFallbackVideoExport(project: Project, brandName: string, sceneDurationSeconds: number) {
  const html = createFallbackVideoHtml(project, brandName, sceneDurationSeconds);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  return {
    url: URL.createObjectURL(blob),
    mimeType: blob.type,
    label: "HTML storyboard player",
  };
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
        {eyebrow}
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{description}</p>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(10,15,30,0.35)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone = "default" }: Metric) {
  return (
    <div
      className={`rounded-3xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
        tone === "success"
          ? "border-emerald-400/20 bg-emerald-400/10"
          : tone === "warn"
            ? "border-amber-400/20 bg-amber-400/10"
            : "border-white/10 bg-slate-950/55"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{children}</span>;
}

function ProgressLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500" style={{ width: `${clamp(value, 0, 100)}%` }} />
      </div>
    </div>
  );
}

export function App() {
  const [activePage, setActivePage] = useState<AppPage>(() => toLocationPage(window.location));
  const [showSignIn, setShowSignIn] = useState(false);
  const [session, setSession] = useState<UserSession | null>(() => loadLocal<UserSession | null>(STORAGE_KEYS.session, null));
  const [settings, setSettings] = useState<Settings>(() => normalizeSettings(loadLocal<Settings>(STORAGE_KEYS.settings, defaultSettings)));
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = loadLocal<Project[]>(STORAGE_KEYS.projects, []);
    return saved.map((project) => ({
      ...project,
      voiceText: project.voiceText ?? project.scenes?.map((scene) => scene.narration).join(" ") ?? "",
      voiceAudioUrl: undefined,
      voiceMimeType: undefined,
      videoUrl: undefined,
      videoMimeType: undefined,
      fallbackVideoUrl: undefined,
      fallbackVideoMimeType: undefined,
      fallbackVideoLabel: undefined,
      exports: {
        script: project.exports?.script ?? true,
        scenePack: project.exports?.scenePack ?? true,
        video: false,
        voice: project.exports?.voice ?? false,
      },
    }));
  });
  const [jobs, setJobs] = useState<PublishJob[]>(() => loadLocal<PublishJob[]>(STORAGE_KEYS.jobs, []));
  const [topics, setTopics] = useState<Topic[]>(() => rankTopics(topicSeeds, true));
  const [activeTopicId, setActiveTopicId] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [collectorQuery, setCollectorQuery] = useState("AI automation startup workflows");
  const [activeSettings, setActiveSettings] = useState<SettingsTab>("API Credentials");
  const [activeFlowTab, setActiveFlowTab] = useState<FlowTab>("User Flow");
  const [notice, setNotice] = useState("Ready. Collect a topic, generate a cinematic storyboard, and export a real vertical image video.");
  const [schedulePlatform, setSchedulePlatform] = useState<PlatformLabel>("YouTube Shorts");
  const [scheduleAt, setScheduleAt] = useState(getDefaultScheduleTime());
  const [signInEmail, setSignInEmail] = useState(session?.email ?? "founder@bamaniaautoforge.ai");
  const [workspaceName, setWorkspaceName] = useState(session?.workspace ?? defaultSettings.security.workspace);
  const [previewScene, setPreviewScene] = useState(0);
  const [playingStoryboard, setPlayingStoryboard] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voicePreviewAudio, setVoicePreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isLiveVoicePreview, setIsLiveVoicePreview] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isCollectingLive, setIsCollectingLive] = useState(false);
  const [collectorMode, setCollectorMode] = useState<"Local Seeds" | "Live YouTube" | "Secure Proxy">("Local Seeds");
  const [liveVideos, setLiveVideos] = useState<YouTubeVideo[]>([]);
  const [liveChannels, setLiveChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [proxyHealth, setProxyHealth] = useState<null | { reachable?: boolean; ok?: boolean; keyConfigured?: boolean; mode?: string; error?: string }>(null);
  const [openAiHealth, setOpenAiHealth] = useState<null | { reachable?: boolean; ok?: boolean; keyConfigured?: boolean; mode?: string; error?: string }>(null);
  const [sarvamHealth, setSarvamHealth] = useState<null | { reachable?: boolean; ok?: boolean; keyConfigured?: boolean; mode?: string; error?: string; provider?: string; model?: string; speaker?: string; languageCode?: string; sampleRate?: number; apiBaseUrl?: string }>(null);

  useEffect(() => {
    const onRouteChange = () => setActivePage(toLocationPage(window.location));
    window.addEventListener("popstate", onRouteChange);
    window.addEventListener("hashchange", onRouteChange);
    return () => {
      window.removeEventListener("popstate", onRouteChange);
      window.removeEventListener("hashchange", onRouteChange);
    };
  }, []);

  useEffect(() => {
    saveLocal(STORAGE_KEYS.settings, settings);
  }, [settings]);

  useEffect(() => {
    saveLocal(STORAGE_KEYS.session, session);
  }, [session]);

  useEffect(() => {
    const serializable = projects.map(({ videoUrl, videoMimeType, fallbackVideoUrl, fallbackVideoMimeType, fallbackVideoLabel, ...project }) => project);
    saveLocal(STORAGE_KEYS.projects, serializable);
  }, [projects]);

  useEffect(() => {
    saveLocal(STORAGE_KEYS.jobs, jobs);
  }, [jobs]);

  useEffect(() => {
    if (!topics.length) return;
    setActiveTopicId((current) => (topics.some((topic) => topic.id === current) ? current : topics[0].id));
  }, [topics]);

  useEffect(() => {
    if (!projects.length) {
      setActiveProjectId(null);
      return;
    }
    setActiveProjectId((current) => (current && projects.some((project) => project.id === current) ? current : projects[0].id));
  }, [projects]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const dueJobs = jobs.filter((job) => job.status === "scheduled" && new Date(job.scheduledFor).getTime() <= now);
      if (!dueJobs.length) return;

      const publishedProjectIds = dueJobs
        .filter((job) => settings.systemActive && settings.socialAccounts[platformToKey(job.platform)])
        .map((job) => job.projectId);

      if (publishedProjectIds.length) {
        setProjects((current) =>
          current.map((project) =>
            publishedProjectIds.includes(project.id)
              ? {
                  ...project,
                  status: "published",
                }
              : project,
          ),
        );
      }

      setJobs((current) =>
        current.map((job) => {
          if (!dueJobs.some((due) => due.id === job.id)) return job;
          const connected = settings.socialAccounts[platformToKey(job.platform)];
          return {
            ...job,
            attempts: job.attempts + 1,
            status: settings.systemActive && connected ? "published" : "failed",
            error: settings.systemActive && connected ? undefined : settings.systemActive ? "Platform not connected" : "System inactive",
          };
        }),
      );

      setNotice(
        publishedProjectIds.length
          ? `Scheduler processed ${publishedProjectIds.length} queued item${publishedProjectIds.length > 1 ? "s" : ""}.`
          : "Scheduler attempted to publish, but at least one platform is not connected or the system is inactive.",
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [jobs, settings.socialAccounts, settings.systemActive]);

  useEffect(() => {
    if (settings.integrations.youtubeMode !== "server-proxy") {
      setProxyHealth(null);
      return;
    }
    fetchYouTubeProxyHealth(settings.integrations.proxyBaseUrl)
      .then((health) => setProxyHealth({ ...health, reachable: true }))
      .catch((error) =>
        setProxyHealth({
          reachable: false,
          ok: false,
          keyConfigured: false,
          mode: "server-proxy",
          error: error instanceof Error ? error.message : "Proxy unreachable",
        }),
      );
  }, [settings.integrations.proxyBaseUrl, settings.integrations.youtubeMode]);

  useEffect(() => {
    const base = (settings.integrations.proxyBaseUrl || "/").replace(/\/$/, "");
    fetch(`${base}/api/openai/health`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "OpenAI health check failed");
        setOpenAiHealth({ ...data, reachable: true });
      })
      .catch((error) =>
        setOpenAiHealth({
          reachable: false,
          ok: false,
          keyConfigured: false,
          mode: "server-proxy",
          error: error instanceof Error ? error.message : "OpenAI backend unreachable",
        }),
      );
  }, [settings.integrations.proxyBaseUrl]);

  useEffect(() => {
    fetchSarvamHealth(settings.integrations.proxyBaseUrl)
      .then((health) => setSarvamHealth({ ...health, reachable: true }))
      .catch((error) =>
        setSarvamHealth({
          reachable: false,
          ok: false,
          keyConfigured: false,
          mode: "server-proxy",
          error: error instanceof Error ? error.message : "Sarvam backend unreachable",
          provider: "sarvam",
          model: undefined,
          speaker: undefined,
          languageCode: undefined,
          sampleRate: undefined,
          apiBaseUrl: undefined,
        }),
      );
  }, [settings.integrations.proxyBaseUrl]);

  useEffect(() => {
    document.title = `${pageLabels[activePage]} | bamania auto forge AI`;
  }, [activePage]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAvailableVoices([]);
      return;
    }

    const syncVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };

    syncVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", syncVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", syncVoices);
    };
  }, []);

  useEffect(() => {
    if (!liveChannels.length) {
      setSelectedChannelId("");
      return;
    }
    setSelectedChannelId((current) => (liveChannels.some((channel) => channel.id === current) ? current : liveChannels[0].id));
  }, [liveChannels]);

  const activeTopic = useMemo(() => topics.find((topic) => topic.id === activeTopicId) ?? topics[0] ?? null, [topics, activeTopicId]);
  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null, [projects, activeProjectId]);
  const activeScene = activeProject?.scenes[previewScene] ?? null;

  const youtubeStatusMessage = settings.integrations.youtubeMode === "server-proxy"
    ? proxyHealth?.reachable === false
      ? "Backend secure proxy is not reachable in this preview/runtime. This usually means you are viewing a static preview without serverless API routes. Deploy to Vercel and set YOUTUBE_API_KEY to activate secure backend collection."
      : proxyHealth?.ok
        ? `Secure backend proxy is reachable at ${settings.integrations.proxyBaseUrl}.`
        : "Backend secure proxy is reachable, but YOUTUBE_API_KEY is not configured on the server yet."
    : settings.apiKeys.youtube.trim()
      ? "Configured. The collector can call YouTube Data API v3 directly in MVP mode."
      : "Not configured. Add a YouTube API key or enable the backend proxy for live collection.";

  const openAiStatusMessage = openAiHealth?.reachable === false
    ? "OpenAI backend route is not reachable in this preview/runtime. This usually means serverless APIs are not running here. Deploy to Vercel and add OPENAI_API_KEY to activate backend storyboard generation."
    : openAiHealth?.ok
      ? "Secure server-side OpenAI storyboard generation is available. Hindi cinematic scripts will use the backend AI route."
      : "OpenAI backend route is reachable, but OPENAI_API_KEY is not configured on the server yet. The app will fall back to the local Hindi storyboard generator.";

  const sarvamStatusMessage = sarvamHealth?.reachable === false
    ? "Sarvam backend route is not reachable in this preview/runtime. This usually means serverless APIs are not running here. Deploy to Vercel and add SARVAM_API_KEY to activate secure voice generation."
    : sarvamHealth?.ok
      ? "Secure server-side Sarvam AI Hindi text-to-speech is available. Voice generation will return real playable audio tracks."
      : "Sarvam backend route is reachable, but SARVAM_API_KEY is not configured on the server yet. The app will fall back to browser-based Hindi voice generation and preview.";
  const baseSceneDuration = useMemo(() => 1.15 / Math.max(settings.motionPace, 0.5), [settings.motionPace]);
  const estimatedSceneDuration = useMemo(() => baseSceneDuration * settings.videoLengthMultiplier, [baseSceneDuration, settings.videoLengthMultiplier]);
  const estimatedVideoDuration = useMemo(() => (activeProject ? activeProject.scenes.length * estimatedSceneDuration : 0), [activeProject, estimatedSceneDuration]);
  const videoLengthPresets = useMemo(
    () => [
      { label: "Short", value: 1 },
      { label: "Medium", value: 1.5 },
      { label: "Long", value: 2.25 },
    ],
    [],
  );
  const targetDurationPresets = useMemo(
    () => [
      { label: "15s", seconds: 15 },
      { label: "30s", seconds: 30 },
      { label: "60s", seconds: 60 },
    ],
    [],
  );
  const activeVideoLengthPreset = useMemo(
    () => videoLengthPresets.find((preset) => Math.abs(settings.videoLengthMultiplier - preset.value) < 0.01)?.label ?? "Custom",
    [settings.videoLengthMultiplier, videoLengthPresets],
  );
  const currentTargetDuration = useMemo(
    () => targetDurationPresets.find((preset) => Math.abs(estimatedVideoDuration - preset.seconds) <= 1)?.label ?? "Flexible",
    [estimatedVideoDuration, targetDurationPresets],
  );
  const preferredVoice = useMemo(() => {
    if (!availableVoices.length) return null;
    return (
      availableVoices.find((voice) => voice.voiceURI === settings.voice.selectedVoiceURI) ??
      availableVoices.find((voice) => voice.lang.toLowerCase().startsWith("hi")) ??
      availableVoices[0]
    );
  }, [availableVoices, settings.voice.selectedVoiceURI]);
  const currentSettings = useMemo(() => settingsTabs.find((tab) => tab.title === activeSettings) ?? settingsTabs[0], [activeSettings]);

  const invalidateActiveProjectVideo = () => {
    setProjects((current) =>
      current.map((entry) =>
        entry.id === activeProjectId
          ? {
              ...entry,
              videoUrl: undefined,
              videoMimeType: undefined,
              fallbackVideoUrl: undefined,
              fallbackVideoMimeType: undefined,
              fallbackVideoLabel: undefined,
              status: entry.status === "published" ? entry.status : "draft",
              exports: {
                ...entry.exports,
                video: false,
              },
            }
          : entry,
      ),
    );
  };

  const applyVideoLengthMultiplier = (nextMultiplier: number, sourceLabel: string) => {
    const safeMultiplier = clamp(Number(nextMultiplier.toFixed(2)), VIDEO_LENGTH_MIN, VIDEO_LENGTH_MAX);
    setSettings((current) => ({
      ...current,
      videoLengthMultiplier: safeMultiplier,
    }));
    invalidateActiveProjectVideo();
    setNotice(`${sourceLabel} length preset applied at ${safeMultiplier.toFixed(2)}x. Preview timing updated and the project is ready for a fresh cinematic export.`);
  };

  const fitVideoToTargetDuration = (targetSeconds: number) => {
    const sceneCount = Math.max(activeProject?.scenes.length ?? 4, 1);
    const requiredMultiplier = targetSeconds / (sceneCount * baseSceneDuration);
    const safeMultiplier = clamp(Number(requiredMultiplier.toFixed(2)), VIDEO_LENGTH_MIN, VIDEO_LENGTH_MAX);
    setSettings((current) => ({
      ...current,
      videoLengthMultiplier: safeMultiplier,
    }));
    invalidateActiveProjectVideo();
    setNotice(`Auto-fit enabled. ${sceneCount} scenes are now timed to approximately ${targetSeconds}s total at ${safeMultiplier.toFixed(2)}x.`);
  };

  useEffect(() => {
    if (!playingStoryboard) return;
    const previewInterval = Math.max(900, estimatedSceneDuration * 1000);
    const interval = window.setInterval(() => {
      setPreviewScene((current) => {
        const count = activeProject?.scenes.length ?? 1;
        return (current + 1) % count;
      });
    }, previewInterval);
    return () => window.clearInterval(interval);
  }, [playingStoryboard, activeProject?.scenes.length, estimatedSceneDuration]);

  const connectedCount = useMemo(() => Object.values(settings.socialAccounts).filter(Boolean).length, [settings.socialAccounts]);
  const publishedCount = useMemo(() => projects.filter((project) => project.status === "published").length, [projects]);
  const queuedCount = useMemo(() => jobs.filter((job) => job.status === "scheduled").length, [jobs]);
  const successRate = useMemo(() => {
    if (!jobs.length) return 100;
    const successful = jobs.filter((job) => job.status === "published").length;
    return Math.round((successful / jobs.length) * 100);
  }, [jobs]);
  const readinessScore = useMemo(() => {
    let score = 40;
    if (settings.systemActive) score += 20;
    if (connectedCount > 0) score += 10;
    if (projects.length > 0) score += 10;
    if (projects.some((project) => project.exports.video)) score += 10;
    if (settings.integrations.youtubeMode === "server-proxy" ? proxyHealth?.ok : settings.apiKeys.youtube.trim()) score += 10;
    return clamp(score, 0, 100);
  }, [connectedCount, projects, proxyHealth?.ok, settings.apiKeys.youtube, settings.integrations.youtubeMode, settings.systemActive]);

  const metrics = useMemo<Metric[]>(
    () => [
      { label: "Topics ranked", value: String(topics.length) },
      { label: "Projects", value: String(projects.length) },
      { label: "Videos exported", value: String(projects.filter((project) => project.exports.video).length), tone: "success" },
      { label: "Publish success", value: `${successRate}%`, tone: successRate >= 70 ? "success" : "warn" },
    ],
    [projects, successRate, topics.length],
  );

  const activePipelineLabel = useMemo(() => {
    if (isRenderingVideo) return "Rendering cinematic video";
    if (isCollectingLive) return "Collecting trends";
    if (playingStoryboard) return "Previewing storyboard";
    if (queuedCount > 0) return "Jobs scheduled";
    return "Ready for execution";
  }, [isCollectingLive, isRenderingVideo, playingStoryboard, queuedCount]);

  const activePipelineTone = useMemo(() => {
    if (isRenderingVideo || isCollectingLive || playingStoryboard) return "bg-amber-400/15 text-amber-100 border-amber-300/20";
    if (settings.systemActive) return "bg-emerald-400/15 text-emerald-100 border-emerald-300/20";
    return "bg-slate-800 text-slate-200 border-white/10";
  }, [isCollectingLive, isRenderingVideo, playingStoryboard, settings.systemActive]);

  const trendBreakdown = activeTopic
    ? [
        { label: "Freshness", value: activeTopic.freshness },
        { label: "Velocity", value: activeTopic.velocity },
        { label: "Commercial", value: activeTopic.commercial },
        { label: "Rank score", value: activeTopic.score },
      ]
    : [];

  const userFlowSteps = [
    {
      key: "signin",
      title: "Sign in to workspace",
      description: "Start the product journey by opening a workspace session for bamania auto forge AI.",
      complete: Boolean(session),
      cta: session ? "Open dashboard" : "Sign in now",
      action: () => {
        if (session) {
          navigate("dashboard");
        } else {
          setShowSignIn(true);
          setNotice("Open the sign-in dialog to begin the user flow.");
        }
      },
      page: "dashboard" as AppPage,
    },
    {
      key: "configure",
      title: "Configure system",
      description: "Set workspace preferences, YouTube mode, API credentials, and connected platforms.",
      complete:
        settings.systemActive &&
        Boolean(settings.security.workspace.trim()) &&
        (settings.integrations.youtubeMode === "server-proxy" ? Boolean(proxyHealth?.ok || proxyHealth?.keyConfigured) : Boolean(settings.apiKeys.youtube.trim())),
      cta: "Open settings",
      action: () => {
        navigate("settings");
        setActiveSettings("API Credentials");
        setNotice("Complete credentials and workspace configuration to continue the flow.");
      },
      page: "settings" as AppPage,
    },
    {
      key: "discover",
      title: "Discover trend opportunities",
      description: "Collect live YouTube topics, thumbnails, metadata, and channel research signals.",
      complete: topics.length > topicSeeds.length || liveVideos.length > 0,
      cta: "Open generator",
      action: () => {
        navigate("generator");
        setNotice("Use the collector to fetch trend opportunities and select a topic.");
      },
      page: "generator" as AppPage,
    },
    {
      key: "generate",
      title: "Generate Hindi storyboard",
      description: "Turn the selected topic into a Hindi-only cinematic script and scene pack.",
      complete: projects.length > 0,
      cta: activeTopic ? "Generate now" : "Pick topic first",
      action: () => {
        navigate("generator");
        if (activeTopic) {
          void generateScript(activeTopic);
        } else {
          setNotice("Select a topic before generating a storyboard.");
        }
      },
      page: "generator" as AppPage,
    },
    {
      key: "render",
      title: "Render cinematic video",
      description: "Export the generated still-image storyboard into a real vertical WebM video.",
      complete: projects.some((project) => project.exports.video),
      cta: activeProject ? "Render now" : "Need project",
      action: () => {
        if (activeProject) {
          void renderProjectVideo(activeProject);
        } else {
          navigate("generator");
          setNotice("Generate a project before rendering video.");
        }
      },
      page: "studio" as AppPage,
    },
    {
      key: "publish",
      title: "Queue or publish",
      description: "Schedule local publishing jobs or publish instantly to a connected destination.",
      complete: jobs.length > 0 || publishedCount > 0,
      cta: activeProject ? "Open library" : "Need project",
      action: () => {
        navigate("library");
        setNotice(activeProject ? "Use the library scheduler to queue or publish the active project." : "Create a project before using the publish flow.");
      },
      page: "library" as AppPage,
    },
  ] as const;

  const automationFlowSteps = [
    {
      key: "collector",
      title: "Topic collector",
      description: "Collect search, trending, region, category, and channel-based YouTube signals.",
      complete: liveVideos.length > 0 || topics.length > 0,
      cta: "Open generator",
      action: () => navigate("generator"),
    },
    {
      key: "analyzer",
      title: "Topic analyzer",
      description: "Rank each topic by freshness, velocity, and commercial potential.",
      complete: Boolean(activeTopic),
      cta: "Inspect topic",
      action: () => navigate("generator"),
    },
    {
      key: "script",
      title: "Script engine",
      description: "Generate Hindi hooks, scenes, captions, and CTA for cinematic output.",
      complete: projects.length > 0,
      cta: "Open studio",
      action: () => navigate(projects.length ? "studio" : "generator"),
    },
    {
      key: "scene",
      title: "Scene generator",
      description: "Build branded cinematic SVG image frames for each storyboard scene.",
      complete: Boolean(activeProject?.scenes.length),
      cta: "Preview scenes",
      action: () => navigate("studio"),
    },
    {
      key: "video",
      title: "Video composer",
      description: "Compose image frames into a downloadable 9:16 cinematic WebM export.",
      complete: projects.some((project) => project.exports.video),
      cta: "Render video",
      action: () => navigate("studio"),
    },
    {
      key: "queue",
      title: "Scheduler & queue",
      description: "Stage content for local publish simulation and maintain job history.",
      complete: jobs.length > 0,
      cta: "Open library",
      action: () => navigate("library"),
    },
  ] as const;

  const flowCompletion = Math.round((userFlowSteps.filter((step) => step.complete).length / userFlowSteps.length) * 100);
  const automationCompletion = Math.round((automationFlowSteps.filter((step) => step.complete).length / automationFlowSteps.length) * 100);

  const verificationChecks = [
    {
      item: "Page-wise app shell",
      status: "Working",
      detail: "The app is now organized into dedicated views for dashboard, flow, generator, studio, library, analytics, settings, and verification.",
    },
    {
      item: "Clickable user flow / click flow",
      status: "Working",
      detail: "A dedicated Flow page now guides users step by step from sign-in to configuration, topic discovery, storyboard generation, video rendering, and publish actions.",
    },
    {
      item: "Live YouTube thumbnails and metadata",
      status: "Working",
      detail: "The collector fetches live thumbnails, publish dates, channel names, views, likes, and comments when YouTube discovery is enabled.",
    },
    {
      item: "Hindi-only cinematic script generation",
      status: "Working",
      detail: "Generated scripts, hooks, captions, and calls to action are created in Hindi for cinematic image-video output.",
    },
    {
      item: "Secure server-side OpenAI storyboard generation",
      status: openAiHealth?.ok ? "Working" : openAiHealth?.reachable === false ? "Deploy" : "Next",
      detail: openAiHealth?.ok
        ? "The app can generate Hindi cinematic storyboard data through a backend OpenAI serverless route without exposing the API key to the browser."
        : openAiHealth?.reachable === false
          ? "OpenAI backend support is implemented, but this preview runtime does not expose the serverless route. Deploy to Vercel and add OPENAI_API_KEY to activate it."
          : "OpenAI backend support is implemented, but it requires OPENAI_API_KEY in the deployment environment to activate.",
    },
    {
      item: "Sarvam AI Hindi text-to-speech",
      status: sarvamHealth?.ok ? "Working" : sarvamHealth?.reachable === false ? "Deploy" : "Fallback",
      detail: sarvamHealth?.ok
        ? "Hindi narration is generated through a secure Sarvam AI server route and returned as playable audio without exposing the API key to the browser."
        : sarvamHealth?.reachable === false
          ? "Sarvam backend support is implemented, but this preview runtime does not expose the serverless route. Deploy to Vercel and add SARVAM_API_KEY to activate secure TTS."
          : "Sarvam backend support is implemented. If the server key is unavailable, the app falls back to browser-based Hindi voice preview/package generation.",
    },
    {
      item: "Voice-in-video integration",
      status: settings.voice.includeInVideo ? "Working" : "Optional",
      detail: settings.voice.includeInVideo
        ? "When narration is enabled for the pipeline, video export attempts to auto-generate voice if needed and embed the resulting audio track into the exported cinematic WebM video."
        : "Voice generation is available, but embedding narration into the exported video is currently turned off in Settings.",
    },
    {
      item: "Cinematic image-video export",
      status: "Working",
      detail: "Canvas capture and MediaRecorder export a real vertical WebM file from generated cinematic still-image scenes, and the full factory can now auto-render the video after project generation.",
    },
    {
      item: "Fallback video generation",
      status: "Working",
      detail: "If browser WebM export is unsupported or fails, the app automatically creates a playable cinematic HTML storyboard player so every project still gets a usable fallback export.",
    },
    {
      item: "Automation scheduler",
      status: "Working", 
      detail: "Queued jobs are processed locally while the app is open and statuses update inside the content library.",
    },
    {
      item: "External social API publishing",
      status: "Next",
      detail: "Platform connections remain MVP toggles until OAuth upload integrations are added in a backend milestone.",
    },
  ] as const;

  const navigate = (page: AppPage) => {
    const nextHash = routeHref(page);
    if (window.location.hash !== nextHash) {
      window.history.pushState({}, "", nextHash);
    }
    setActivePage(page);
  };

  const setTopicAndOpen = (topicId: string) => {
    setActiveTopicId(topicId);
    navigate("generator");
  };

  const setProjectAndOpen = (projectId: string) => {
    setActiveProjectId(projectId);
    navigate("studio");
  };

  const connectPlatform = (platform: PlatformKey) => {
    if (platform === "youtube" && !settings.socialAccounts.youtube) {
      const usingProxy = settings.integrations.youtubeMode === "server-proxy";
      const canConnect = usingProxy ? Boolean(proxyHealth?.keyConfigured || proxyHealth?.ok) : Boolean(settings.apiKeys.youtube.trim());
      if (!canConnect) {
        setActiveSettings("API Credentials");
        navigate("settings");
        setNotice("Add a YouTube Data API key or enable the backend proxy before enabling the YouTube collector integration.");
        return;
      }
    }

    setSettings((current) => ({
      ...current,
      socialAccounts: {
        ...current.socialAccounts,
        [platform]: !current.socialAccounts[platform],
      },
    }));
    const connected = !settings.socialAccounts[platform];
    setNotice(`${platformLabels[platform]} ${connected ? "connected" : "disconnected"}.`);
  };

  const collectTopics = async () => {
    const dynamicTopics = buildDynamicTopics(collectorQuery);
    const fallbackRanked = rankTopics([...topicSeeds, ...dynamicTopics], settings.systemActive);
    const usingProxy = settings.integrations.youtubeMode === "server-proxy";
    const hasDirectKey = settings.apiKeys.youtube.trim().length > 0;

    if (!usingProxy && !hasDirectKey) {
      setCollectorMode("Local Seeds");
      setLiveVideos([]);
      setLiveChannels([]);
      setTopics(fallbackRanked);
      setActiveTopicId(fallbackRanked[0]?.id ?? "");
      setNotice(`Collected ${fallbackRanked.length} ranked topics from local seeds. Add a YouTube API key or enable the backend proxy for live YouTube collection.`);
      return fallbackRanked;
    }

    setIsCollectingLive(true);
    setNotice(usingProxy ? "Fetching live YouTube data through the backend proxy..." : "Fetching live YouTube topics from YouTube Data API v3...");

    try {
      const commonOptions = {
        query: collectorQuery,
        apiKey: settings.apiKeys.youtube,
        mode: settings.integrations.youtubeMode,
        proxyBaseUrl: settings.integrations.proxyBaseUrl,
        regionCode: settings.integrations.regionCode,
        relevanceLanguage: settings.integrations.relevanceLanguage,
        videoCategoryId: settings.integrations.categoryId,
        maxResults: 8,
      } as const;

      const [liveSeeds, trendingSeeds, channels] = await Promise.all([
        fetchYouTubeTrendSeeds(commonOptions),
        fetchYouTubeTrendingTopicSeeds(commonOptions),
        fetchYouTubeChannels(commonOptions),
      ]);

      const channelId = selectedChannelId || channels[0]?.id;
      const channelVideos = channelId
        ? await fetchYouTubeChannelVideos({
            ...commonOptions,
            channelId,
            maxResults: 6,
          })
        : [];

      const searchVideos = [...liveSeeds, ...trendingSeeds].map((seed) => ({
        id: seed.videoId,
        title: seed.title,
        description: seed.notes,
        publishedAt: seed.publishedAt,
        channelId: seed.channelId,
        channelTitle: seed.channelTitle,
        thumbnailUrl: seed.thumbnailUrl,
        viewCount: seed.viewCount,
        likeCount: seed.likeCount,
        commentCount: seed.commentCount,
        duration: seed.duration,
        regionCode: seed.regionCode,
        categoryId: seed.categoryId,
      }));

      const uniqueVideos = Array.from(new Map([...searchVideos, ...channelVideos].map((video) => [video.id, video])).values()).slice(0, 12);
      const channelTopics = channelVideos.map((video) => videoToTopic(video, collectorQuery));
      const ranked = rankTopics([...liveSeeds, ...trendingSeeds, ...channelTopics, ...dynamicTopics, ...topicSeeds], settings.systemActive);

      setLiveVideos(uniqueVideos);
      setLiveChannels(channels);
      setSelectedChannelId(channelId ?? "");
      setCollectorMode(usingProxy ? "Secure Proxy" : uniqueVideos.length ? "Live YouTube" : "Local Seeds");
      setTopics(ranked);
      setActiveTopicId(ranked[0]?.id ?? "");
      setNotice(
        uniqueVideos.length
          ? `Collected ${ranked.length} ranked topics with live YouTube thumbnails, metadata, trending signals, and ${channels.length} matching channels.`
          : `No live YouTube matches were found for this query. Loaded ${ranked.length} fallback topics instead.`,
      );
      return ranked;
    } catch (error) {
      setCollectorMode("Local Seeds");
      setLiveVideos([]);
      setLiveChannels([]);
      setTopics(fallbackRanked);
      setActiveTopicId(fallbackRanked[0]?.id ?? "");
      setNotice(`Live YouTube collection failed: ${error instanceof Error ? error.message : "unknown error"}. Falling back to local ranked topics.`);
      return fallbackRanked;
    } finally {
      setIsCollectingLive(false);
    }
  };

  const generateScript = async (topicOverride?: Topic) => {
    const targetTopic = topicOverride ?? activeTopic;
    if (!targetTopic) {
      setNotice("Select a topic first.");
      return null;
    }

    const canUseOpenAi = Boolean(openAiHealth?.ok || openAiHealth?.keyConfigured);
    let project: Project;

    if (canUseOpenAi) {
      try {
        setNotice(`Generating Hindi cinematic storyboard with OpenAI for “${targetTopic.title}”.`);
        const response = await generateHindiStoryboard({
          topic: {
            title: targetTopic.title,
            angle: targetTopic.angle,
            notes: targetTopic.notes,
            keywords: targetTopic.keywords,
          },
          brandName: settings.brandName,
          language: "Hindi",
          proxyBaseUrl: settings.integrations.proxyBaseUrl,
        });
        project = buildProjectFromAiStoryboard(targetTopic, settings, response.data);
      } catch (error) {
        project = generateProject(targetTopic, settings);
        setNotice(`OpenAI storyboard unavailable: ${error instanceof Error ? error.message : "unknown error"}. Used local Hindi generator instead.`);
      }
    } else {
      project = generateProject(targetTopic, settings);
      setNotice(`Generated Hindi cinematic storyboard assets for “${targetTopic.title}” with the local generator.`);
    }

    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
    setPreviewScene(0);
    navigate("studio");
    if (canUseOpenAi && project.scriptTitle) {
      setNotice(`Generated Hindi cinematic storyboard assets for “${targetTopic.title}”.`);
    }
    return project;
  };

  const renderProjectVideo = async (project: Project) => {
    const sceneDuration = baseSceneDuration * settings.videoLengthMultiplier;
    const applyFallbackVideo = (reason: string) => {
      const fallback = createFallbackVideoExport(project, settings.brandName, sceneDuration);
      setProjects((current) =>
        current.map((entry) =>
          entry.id === project.id
            ? {
                ...entry,
                videoUrl: undefined,
                videoMimeType: undefined,
                fallbackVideoUrl: fallback.url,
                fallbackVideoMimeType: fallback.mimeType,
                fallbackVideoLabel: fallback.label,
                status: "video-ready",
                exports: {
                  ...entry.exports,
                  video: true,
                },
              }
            : entry,
        ),
      );
      setVideoProgress(100);
      setNotice(`${reason} A fallback cinematic HTML player was generated for “${project.scriptTitle}”. Open or download it from Studio.`);
      return true;
    };

    const mimeType = getRecorderMimeType();
    if (!mimeType) {
      return applyFallbackVideo("This browser does not support MediaRecorder WebM export.");
    }

    setActiveProjectId(project.id);
    navigate("studio");
    setIsRenderingVideo(true);
    setPlayingStoryboard(false);
    setPreviewScene(0);
    setVideoProgress(0);

    let workingProject = project;
    let narrationEmbedded = false;
    const shouldEmbedVoice = settings.voice.enabled && settings.voice.includeInVideo;

    try {
      if (shouldEmbedVoice && !workingProject.voiceAudioUrl) {
        setNotice(`Generating narration for “${project.scriptTitle}” before video export...`);
        const generatedVoice = await renderVoiceForProject(project);
        if (generatedVoice) {
          const refreshed = projects.find((entry) => entry.id === project.id) ?? null;
          if (refreshed?.voiceAudioUrl) {
            workingProject = refreshed;
          }
        }
      }

      setNotice(
        shouldEmbedVoice
          ? `Rendering cinematic WebM video with narration for “${project.scriptTitle}”.`
          : `Rendering a real cinematic WebM video for “${project.scriptTitle}”.`,
      );

      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 1280;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      if (typeof canvas.captureStream !== "function") throw new Error("Canvas capture stream unavailable");

      const videoStream = canvas.captureStream(12);
      let finalStream = videoStream;
      let narrationAudio: HTMLAudioElement | null = null;
      let audioTracks: MediaStreamTrack[] = [];

      if (shouldEmbedVoice && workingProject.voiceAudioUrl && workingProject.voiceMimeType?.startsWith("audio/")) {
        try {
          narrationAudio = await loadAudioElement(workingProject.voiceAudioUrl);
          narrationAudio.crossOrigin = "anonymous";
          narrationAudio.volume = 1;
          narrationAudio.currentTime = 0;
          narrationAudio.muted = false;
          const audioWithCapture = narrationAudio as HTMLAudioElement & { captureStream?: () => MediaStream };
          if (typeof audioWithCapture.captureStream === "function") {
            const narrationStream = audioWithCapture.captureStream();
            audioTracks = narrationStream.getAudioTracks();
            if (audioTracks.length) {
              finalStream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
              narrationEmbedded = true;
            }
          }
        } catch {
          narrationEmbedded = false;
        }
      }

      const recorder = new MediaRecorder(finalStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      recorder.start();
      const fps = 12;
      const totalFrames = Math.max(workingProject.scenes.length * Math.round(sceneDuration * fps), 1);
      let processed = 0;

      if (narrationAudio && narrationEmbedded) {
        try {
          await narrationAudio.play();
        } catch {
          narrationEmbedded = false;
        }
      }

      for (let sceneIndex = 0; sceneIndex < workingProject.scenes.length; sceneIndex += 1) {
        const scene = workingProject.scenes[sceneIndex];
        const image = await loadImage(scene.imageUrl);
        const sceneFrames = Math.max(Math.round(sceneDuration * fps), 1);

        for (let frame = 0; frame < sceneFrames; frame += 1) {
          drawVideoFrame(ctx, scene, image, settings.brandName, sceneIndex, workingProject.scenes.length, frame / sceneFrames);
          processed += 1;
          if (processed % 2 === 0 || processed === totalFrames) {
            setVideoProgress(Math.round((processed / totalFrames) * 100));
          }
          await sleep(1000 / fps);
        }
      }

      if (narrationAudio && narrationEmbedded) {
        narrationAudio.pause();
        narrationAudio.currentTime = 0;
      }
      recorder.stop();
      const blob = await stopped;
      const videoUrl = URL.createObjectURL(blob);

      setProjects((current) =>
        current.map((entry) =>
          entry.id === workingProject.id
            ? {
                ...entry,
                videoUrl,
                videoMimeType: blob.type,
                fallbackVideoUrl: undefined,
                fallbackVideoMimeType: undefined,
                fallbackVideoLabel: undefined,
                status: "video-ready",
                exports: {
                  ...entry.exports,
                  video: true,
                },
              }
            : entry,
        ),
      );

      setVideoProgress(100);
      setNotice(
        narrationEmbedded
          ? `Video render complete for “${workingProject.scriptTitle}” with narration embedded. Preview and download are now available.`
          : shouldEmbedVoice
            ? `Video render complete for “${workingProject.scriptTitle}”. Narration could not be embedded, so the export was created as a silent cinematic video.`
            : `Video render complete for “${workingProject.scriptTitle}”. Preview and download are now available.`,
      );
      return true;
    } catch {
      return applyFallbackVideo("Primary video render failed.");
    } finally {
      setIsRenderingVideo(false);
    }
  };

  const renderVoiceForProject = async (project: Project) => {
    const text = project.voiceText?.trim() || project.scenes.map((scene) => scene.narration).join(" ");
    if (!text) {
      setNotice("No narration text is available for voice generation.");
      return false;
    }

    const browserVoiceSupported = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!sarvamHealth?.ok && !browserVoiceSupported) {
      setNotice("Voice generation requires either Sarvam AI server access or browser speech synthesis support.");
      return false;
    }

    setActiveProjectId(project.id);
    navigate("studio");
    if (browserVoiceSupported) {
      window.speechSynthesis.cancel();
    }
    setIsGeneratingVoice(true);
    setIsPlayingVoice(false);

    try {
      if (sarvamHealth?.ok) {
        const result = await generateSarvamVoice({
          text,
          title: project.scriptTitle,
          languageCode: settings.voice.language,
          proxyBaseUrl: settings.integrations.proxyBaseUrl,
        });

        setProjects((current) =>
          current.map((entry) =>
            entry.id === project.id
              ? {
                  ...entry,
                  voiceText: text,
                  voiceAudioUrl: result.audioUrl,
                  voiceMimeType: result.mimeType,
                  exports: {
                    ...entry.exports,
                    voice: true,
                  },
                }
              : entry,
          ),
        );

        setNotice(`Sarvam AI Hindi voice generated for “${project.scriptTitle}”. Preview or download the audio track.`);
        return true;
      }

      if (!browserVoiceSupported) {
        setNotice("Sarvam AI is unavailable and browser voice support was not found.");
        return false;
      }

      const data = {
        scriptTitle: project.scriptTitle,
        text,
        language: settings.voice.language,
        rate: settings.voice.rate,
        pitch: settings.voice.pitch,
        voiceName: preferredVoice?.name ?? "Browser Hindi Voice",
        provider: "browser-fallback",
        generatedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
      const voiceAudioUrl = URL.createObjectURL(blob);

      setProjects((current) =>
        current.map((entry) =>
          entry.id === project.id
            ? {
                ...entry,
                voiceText: text,
                voiceAudioUrl,
                voiceMimeType: blob.type,
                exports: {
                  ...entry.exports,
                  voice: true,
                },
              }
            : entry,
        ),
      );

      setNotice(`Sarvam AI was unavailable, so a browser Hindi voice package was prepared for “${project.scriptTitle}”.`);
      return true;
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const previewVoice = (project: Project) => {
    const text = project.voiceText?.trim() || project.scenes.map((scene) => scene.narration).join(" ");
    if (!text) {
      setNotice("No narration text is available for preview.");
      return;
    }

    if (project.voiceAudioUrl && project.voiceMimeType?.startsWith("audio/")) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (voicePreviewAudio) {
        voicePreviewAudio.pause();
        voicePreviewAudio.currentTime = 0;
      }
      const audio = new Audio(project.voiceAudioUrl);
      setVoicePreviewAudio(audio);
      audio.onplay = () => setIsPlayingVoice(true);
      audio.onended = () => {
        setIsPlayingVoice(false);
        setVoicePreviewAudio(null);
      };
      audio.onerror = () => {
        setIsPlayingVoice(false);
        setVoicePreviewAudio(null);
        setNotice("Audio preview failed. Generate voice again or use browser preview fallback.");
      };
      void audio.play();
      setNotice(`Previewing generated Hindi voice for “${project.scriptTitle}”.`);
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setNotice("Voice preview requires generated audio or browser speech synthesis support.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.voice.language;
    utterance.rate = settings.voice.rate;
    utterance.pitch = settings.voice.pitch;
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.onstart = () => setIsPlayingVoice(true);
    utterance.onend = () => setIsPlayingVoice(false);
    utterance.onerror = () => setIsPlayingVoice(false);
    window.speechSynthesis.speak(utterance);
    setNotice(`Previewing browser Hindi voice narration for “${project.scriptTitle}”.`);
  };

  const stopVoicePreview = () => {
    if (voicePreviewAudio) {
      voicePreviewAudio.pause();
      voicePreviewAudio.currentTime = 0;
      setVoicePreviewAudio(null);
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingStoryboard(false);
    setIsLiveVoicePreview(false);
    setIsPlayingVoice(false);
    setNotice("Voice preview stopped.");
  };

  const startRealtimeVoiceStoryboard = async (project: Project) => {
    const text = project.voiceText?.trim() || project.scenes.map((scene) => scene.narration).join(" ");
    if (!text) {
      setNotice("No narration text is available for real-time preview.");
      return;
    }

    setActiveProjectId(project.id);
    navigate("studio");
    setPreviewScene(0);
    stopVoicePreview();
    setIsLiveVoicePreview(true);
    setPlayingStoryboard(true);

    const sceneCount = Math.max(project.scenes.length, 1);
    const runDurationMs = Math.max(sceneCount * estimatedSceneDuration * 1000, 1200);

    if (project.voiceAudioUrl && project.voiceMimeType?.startsWith("audio/")) {
      try {
        const audio = new Audio(project.voiceAudioUrl);
        setVoicePreviewAudio(audio);
        audio.onplay = () => setIsPlayingVoice(true);
        audio.onended = () => {
          setIsPlayingVoice(false);
          setIsLiveVoicePreview(false);
          setPlayingStoryboard(false);
          setVoicePreviewAudio(null);
        };
        audio.onerror = () => {
          setIsPlayingVoice(false);
          setIsLiveVoicePreview(false);
          setPlayingStoryboard(false);
          setVoicePreviewAudio(null);
          setNotice("Real-time voice preview failed. Generate the voice again or use browser preview.");
        };
        await audio.play();
        window.setTimeout(() => {
          setPlayingStoryboard(false);
          setIsLiveVoicePreview(false);
        }, Math.max(audio.duration * 1000 || 0, runDurationMs));
        setNotice(`Real-time cinematic preview with generated voice started for “${project.scriptTitle}”.`);
        return;
      } catch {
        setVoicePreviewAudio(null);
      }
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setPlayingStoryboard(false);
      setIsLiveVoicePreview(false);
      setNotice("Real-time voice preview requires generated audio or browser speech synthesis support.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.voice.language;
    utterance.rate = settings.voice.rate;
    utterance.pitch = settings.voice.pitch;
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.onstart = () => setIsPlayingVoice(true);
    utterance.onend = () => {
      setIsPlayingVoice(false);
      setIsLiveVoicePreview(false);
      setPlayingStoryboard(false);
    };
    utterance.onerror = () => {
      setIsPlayingVoice(false);
      setIsLiveVoicePreview(false);
      setPlayingStoryboard(false);
    };
    window.speechSynthesis.speak(utterance);
    setNotice(`Real-time cinematic preview with browser Hindi voice started for “${project.scriptTitle}”.`);
  };

  const generateVoiceVideo = async () => {
    if (!activeProject) {
      setNotice("Generate a project first.");
      return;
    }
    setNotice(`Generating real video with voice for “${activeProject.scriptTitle}”.`);
    if (!activeProject.voiceAudioUrl && settings.voice.enabled) {
      await renderVoiceForProject(activeProject);
    }
    const refreshedProject = projects.find((project) => project.id === activeProject.id) ?? activeProject;
    await renderProjectVideo(refreshedProject);
  };

  const renderVideo = async () => {
    if (!activeProject) {
      setNotice("Generate a project first.");
      return;
    }
    await renderProjectVideo(activeProject);
  };

  const runFullFactory = async () => {
    setNotice("Running the full cinematic factory: collect → generate → render video.");
    const ranked = await collectTopics();
    if (!ranked[0]) {
      setNotice("No ranked topics were found. Adjust the query and try again.");
      return;
    }
    const project = await generateScript(ranked[0]);
    if (!project) return;
    await renderProjectVideo(project);
  };

  const inspectChannel = async (channel: YouTubeChannel) => {
    try {
      setSelectedChannelId(channel.id);
      setIsCollectingLive(true);
      const videos = await fetchYouTubeChannelVideos({
        query: collectorQuery,
        apiKey: settings.apiKeys.youtube,
        mode: settings.integrations.youtubeMode,
        proxyBaseUrl: settings.integrations.proxyBaseUrl,
        regionCode: settings.integrations.regionCode,
        relevanceLanguage: settings.integrations.relevanceLanguage,
        videoCategoryId: settings.integrations.categoryId,
        channelId: channel.id,
        maxResults: 6,
      });
      setLiveVideos(videos);
      const ranked = rankTopics([...videos.map((video) => videoToTopic(video, collectorQuery)), ...topicSeeds], settings.systemActive);
      setTopics(ranked);
      setActiveTopicId(ranked[0]?.id ?? "");
      setNotice(`Loaded channel-based discovery from ${channel.title} with ${videos.length} recent videos.`);
    } catch (error) {
      setNotice(`Channel discovery failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    } finally {
      setIsCollectingLive(false);
    }
  };

  const schedulePublish = () => {
    if (!activeProject) {
      setNotice("Generate a project first.");
      return;
    }
    const job: PublishJob = {
      id: uid("job"),
      projectId: activeProject.id,
      platform: schedulePlatform,
      scheduledFor: new Date(scheduleAt).toISOString(),
      status: "scheduled",
      attempts: 0,
    };
    setJobs((current) => [job, ...current]);
    setProjects((current) =>
      current.map((project) => (project.id === activeProject.id ? { ...project, status: "scheduled" } : project)),
    );
    setNotice(`Queued ${activeProject.scriptTitle} for ${schedulePlatform} at ${formatDate(job.scheduledFor)}.`);
  };

  const publishNow = () => {
    if (!activeProject) {
      setNotice("Generate a project first.");
      return;
    }
    const platformKey = platformToKey(schedulePlatform);
    if (!settings.systemActive) {
      setNotice("System is inactive. Enable System Active in settings first.");
      return;
    }
    if (!settings.socialAccounts[platformKey]) {
      setNotice(`${schedulePlatform} is not connected. Use Settings first.`);
      return;
    }

    setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, status: "published" } : project)));
    setJobs((current) => [
      {
        id: uid("job"),
        projectId: activeProject.id,
        platform: schedulePlatform,
        scheduledFor: new Date().toISOString(),
        status: "published",
        attempts: 1,
      },
      ...current,
    ]);
    setNotice(`Published locally to ${schedulePlatform}. Live platform API delivery is the next backend milestone.`);
  };

  const removeProject = (projectId: string) => {
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setJobs((current) => current.filter((job) => job.projectId !== projectId));
    setNotice("Project removed from the local library.");
  };

  const downloadScript = (project: Project) => {
    downloadText(`${project.scriptTitle}.txt`, `${project.script}\n\nCaption:\n${project.caption}\n\n${project.hashtags.join(" ")}`);
  };

  const downloadStoryboard = (project: Project) => {
    downloadText(`${project.scriptTitle}-storyboard.json`, JSON.stringify(project, null, 2), "application/json;charset=utf-8");
  };

  const downloadVideo = (project: Project) => {
    if (project.videoUrl) {
      downloadUrl(`${project.scriptTitle}.webm`, project.videoUrl);
      return;
    }
    if (project.fallbackVideoUrl) {
      downloadUrl(`${project.scriptTitle}-fallback-player.html`, project.fallbackVideoUrl);
      return;
    }
    setNotice("Render the video first.");
  };

  const navItems: AppPage[] = ["dashboard", "flow", "generator", "studio", "library", "analytics", "settings", "verify"];

  const dashboardView = (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations overview"
        title="Multi-page AI studio for cinematic image-video production"
        description="Run trend intelligence, Hindi script generation, storyboard design, browser video export, and publishing queues from a cleaner page-wise control panel."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MiniStat key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="Command center" subtitle="Studio readiness, quick actions, and active pipeline status">
          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-cyan-400/20 bg-cyan-400/10 p-5 text-cyan-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Live pipeline</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{activePipelineLabel}</p>
                  <p className="mt-2 text-sm leading-7 text-cyan-100/90">Collector mode: {collectorMode} • Region {settings.integrations.regionCode} • Category {settings.integrations.categoryId}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${activePipelineTone}`}>{settings.systemActive ? "System Active" : "System Paused"}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Readiness</p>
                <p className="mt-2 text-2xl font-semibold text-white">{readinessScore}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Queued jobs</p>
                <p className="mt-2 text-2xl font-semibold text-white">{queuedCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Connected platforms</p>
                <p className="mt-2 text-2xl font-semibold text-white">{connectedCount}/3</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={runFullFactory}
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Generate full video now
              </button>
              <button
                type="button"
                onClick={() => navigate("flow")}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
              >
                Open click flow
              </button>
              <button
                type="button"
                onClick={() => navigate("generator")}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
              >
                Open generator page
              </button>
              <button
                type="button"
                onClick={() => navigate("settings")}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
              >
                Open system settings
              </button>
            </div>
          </div>
        </Card>

        <Card title="System pulse" subtitle="Workspace, access profile, and YouTube integration health">
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">Workspace</p>
              <p className="mt-2 text-lg font-semibold text-white">{session?.workspace ?? settings.security.workspace}</p>
              <p className="mt-1 text-sm text-emerald-50/90">{session?.email ?? "Sign in to personalize your studio session."}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Security</p>
                <p className="mt-2 text-white">{settings.security.authMode}</p>
                <p className="text-sm text-slate-400">2FA {settings.security.require2FA ? "required" : "optional"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">YouTube mode</p>
                <p className="mt-2 text-white">{settings.integrations.youtubeMode === "server-proxy" ? "Backend secure proxy" : "Client direct"}</p>
                <p className="text-sm text-slate-400">
                  {settings.integrations.youtubeMode === "server-proxy"
                    ? proxyHealth?.reachable === false
                      ? "Proxy unreachable in current preview"
                      : proxyHealth?.ok
                        ? "Proxy healthy"
                        : "Proxy reachable, key missing"
                    : settings.apiKeys.youtube.trim()
                      ? "API key configured"
                      : "API key missing"}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Status log</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{notice}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card title="Top ranked topics" subtitle="Jump directly into the highest scoring opportunities">
          <div className="space-y-3">
            {topics.slice(0, 5).map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setTopicAndOpen(topic.id)}
                className="flex w-full items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
              >
                {topic.thumbnailUrl ? <img src={topic.thumbnailUrl} alt={topic.title} className="h-20 w-14 rounded-xl object-cover" /> : <div className="h-20 w-14 rounded-xl bg-slate-800" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{topic.source}</span>
                    <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Score {topic.score}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 font-semibold text-white">{topic.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{topic.channelTitle ?? topic.angle}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Recent project activity" subtitle="Latest cinematic assets in the local content library">
          <div className="space-y-3">
            {projects.length ? (
              projects.slice(0, 4).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setProjectAndOpen(project.id)}
                  className="flex w-full items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
                >
                  <div>
                    <p className="font-semibold text-white">{project.scriptTitle}</p>
                    <p className="mt-1 text-sm text-slate-400">{formatDate(project.createdAt)} • {project.status}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${project.exports.video ? "bg-emerald-300 text-emerald-950" : "bg-slate-800 text-slate-200"}`}>{project.exports.video ? "Video ready" : "Storyboard ready"}</span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-400">No projects yet. Use the Generator page to create your first cinematic storyboard.</div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );

  const flowView = (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guided journey"
        title="Click flow / user flow page"
        description="Follow a guided clickable journey that moves a user from sign-in to configuration, trend collection, storyboard generation, video export, and publish actions."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="User flow progress" value={`${flowCompletion}%`} tone={flowCompletion >= 60 ? "success" : "warn"} />
        <MiniStat label="Automation flow progress" value={`${automationCompletion}%`} tone={automationCompletion >= 60 ? "success" : "warn"} />
        <MiniStat label="Current step focus" value={activePage === "flow" ? activeFlowTab : pageLabels[activePage]} />
        <MiniStat label="Active session" value={session ? "Signed in" : "Guest"} tone={session ? "success" : "warn"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.32fr_0.68fr]">
        <Card title="Flow mode" subtitle="Switch between product user journey and the internal automation pipeline">
          <div className="space-y-3">
            {(["User Flow", "Automation Flow"] as FlowTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFlowTab(tab)}
                className={`w-full rounded-[1.5rem] border p-4 text-left transition ${activeFlowTab === tab ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/10"}`}
              >
                <p className="font-semibold text-white">{tab}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {tab === "User Flow"
                    ? "See the clickable end-user journey from entering the app to publishing content."
                    : "See the internal production pipeline from collection to queue-based delivery."}
                </p>
              </button>
            ))}
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-slate-300">
              <p className="font-semibold text-white">Current focus</p>
              <p className="mt-2">{activeFlowTab === "User Flow" ? "This view helps founders, clients, or product users understand how to operate the app step by step." : "This view helps teams understand the internal automation stages and production pipeline."}</p>
            </div>
          </div>
        </Card>

        <Card
          title={activeFlowTab === "User Flow" ? "Interactive user journey" : "Interactive automation pipeline"}
          subtitle={activeFlowTab === "User Flow" ? "Every step is clickable and pushes the user into the correct page or action." : "Track the pipeline stage by stage and jump directly into the relevant operational page."}
        >
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-50">
              {activeFlowTab === "User Flow"
                ? "Recommended user journey: Sign in → Configure the system → Discover trends → Generate a Hindi storyboard → Render cinematic video → Queue or publish."
                : "Automation pipeline: Collector → Analyzer → Script engine → Scene generator → Video composer → Scheduler & queue."}
            </div>

            {(activeFlowTab === "User Flow" ? userFlowSteps : automationFlowSteps).map((step, index, arr) => (
              <div key={step.key} className="relative rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                {index < arr.length - 1 ? <div className="pointer-events-none absolute left-9 top-[88px] h-12 w-px bg-gradient-to-b from-cyan-300/60 to-transparent" /> : null}
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${step.complete ? "bg-emerald-300 text-emerald-950" : "bg-slate-800 text-slate-100"}`}>
                      {step.complete ? "✓" : index + 1}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${step.complete ? "bg-emerald-300 text-emerald-950" : "bg-amber-300 text-amber-950"}`}>
                          {step.complete ? "Complete" : "Pending"}
                        </span>
                        {"page" in step ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            {routeHref(step.page)}
                          </span>
                        ) : null}
                      </div>
                      <p className="max-w-3xl text-sm leading-7 text-slate-400">{step.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 md:justify-end">
                    <button
                      type="button"
                      onClick={step.action}
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                    >
                      {step.cta}
                    </button>
                    {activeFlowTab === "User Flow" && "page" in step ? (
                      <button
                        type="button"
                        onClick={() => navigate(step.page)}
                        className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
                      >
                        Open page
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );

  const generatorView = (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trend intelligence"
        title="Generator page"
        description="Collect live YouTube trends, inspect video metadata, explore channels, and turn selected topics into Hindi cinematic storyboards."
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card title="Collector controls" subtitle="Live search, region filters, category filters, and channel discovery">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.45fr_0.45fr_auto]">
              <input
                value={collectorQuery}
                onChange={(event) => setCollectorQuery(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
                placeholder="Add a niche, trend, or channel angle"
              />
              <select
                value={settings.integrations.regionCode}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    integrations: { ...current.integrations, regionCode: event.target.value },
                  }))
                }
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
              >
                {youtubeRegions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.label}
                  </option>
                ))}
              </select>
              <select
                value={settings.integrations.categoryId}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    integrations: { ...current.integrations, categoryId: event.target.value },
                  }))
                }
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
              >
                {youtubeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={collectTopics}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                {isCollectingLive ? "Collecting…" : settings.integrations.youtubeMode === "server-proxy" ? "Collect via proxy" : settings.apiKeys.youtube.trim() ? "Collect live" : "Load local"}
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 text-slate-300">
              Collector mode: <span className="font-semibold text-white">{collectorMode}</span>. {settings.integrations.youtubeMode === "server-proxy" ? "Secure proxy mode keeps the YouTube key on the backend." : "Client direct mode uses the configured YouTube API key in the browser for MVP testing."}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => activeTopic && void generateScript(activeTopic)}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
              >
                Generate Hindi storyboard
              </button>
              <button
                type="button"
                onClick={runFullFactory}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
              >
                Generate video automatically
              </button>
            </div>

            <div className="space-y-3">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setActiveTopicId(topic.id)}
                  className={`flex w-full items-center gap-4 rounded-[1.5rem] border p-4 text-left transition ${topic.id === activeTopicId ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/10"}`}
                >
                  {topic.thumbnailUrl ? <img src={topic.thumbnailUrl} alt={topic.title} className="h-20 w-14 rounded-xl object-cover" /> : <div className="h-20 w-14 rounded-xl bg-slate-800" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{topic.source}</span>
                      <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Rank {topic.score}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 font-semibold text-white">{topic.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{topic.channelTitle ?? topic.angle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Selected topic" subtitle="Actual metadata, ranking breakdown, and story angle">
            {activeTopic ? (
              <div className="space-y-5">
                {activeTopic.thumbnailUrl ? <img src={activeTopic.thumbnailUrl} alt={activeTopic.title} className="h-72 w-full rounded-[1.5rem] object-cover" /> : null}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{activeTopic.source}</span>
                    <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">{activeTopic.channelTitle ?? "Topic seed"}</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{activeTopic.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{activeTopic.angle}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{activeTopic.notes}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {trendBreakdown.map((item) => (
                    <ProgressLine key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Views</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatNumber(activeTopic.viewCount)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Likes</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatNumber(activeTopic.likeCount)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Comments</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatNumber(activeTopic.commentCount)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Published</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatDate(activeTopic.publishedAt)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-400">No topic selected yet.</div>
            )}
          </Card>

          <Card title="Channel discovery" subtitle="Inspect related channels and pivot the collector into channel-based research">
            <div className="space-y-3">
              {liveChannels.length ? (
                liveChannels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => inspectChannel(channel)}
                    className={`flex w-full items-center gap-4 rounded-[1.5rem] border p-4 text-left transition ${channel.id === selectedChannelId ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/10"}`}
                  >
                    {channel.thumbnailUrl ? <img src={channel.thumbnailUrl} alt={channel.title} className="h-14 w-14 rounded-2xl object-cover" /> : <div className="h-14 w-14 rounded-2xl bg-slate-800" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{channel.title}</p>
                      <p className="mt-1 text-sm text-slate-400">Subscribers {formatNumber(channel.subscriberCount)} • Videos {formatNumber(channel.videoCount)}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-400">Collect live topics to unlock channel-based discovery.</div>
              )}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );

  const studioView = (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Creative studio"
        title="Studio page"
        description="Preview scenes, render real cinematic image videos, and export assets from the currently selected project."
      />

      {activeProject ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
            <Card title="Storyboard preview" subtitle="Live cinematic scene preview with autoplay controls">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-4">
                  {activeScene ? <img src={activeScene.imageUrl} alt={activeScene.title} className="mx-auto aspect-[9/16] max-h-[720px] rounded-[1.5rem] object-cover" /> : null}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{activeScene?.title ?? "No scene"}</p>
                      <p className="mt-1 text-sm text-slate-400">{activeScene?.caption ?? "Generate a project to start previewing scenes."}</p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">Scene {activeProject.scenes.length ? previewScene + 1 : 0}/{activeProject.scenes.length}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopVoicePreview();
                      setPlayingStoryboard((current) => !current);
                    }}
                    className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
                  >
                    {playingStoryboard && !isLiveVoicePreview ? "Pause preview" : "Play preview"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void startRealtimeVoiceStoryboard(activeProject)}
                    className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-5 py-3 text-sm font-semibold text-fuchsia-50 transition hover:bg-fuchsia-300/20"
                  >
                    {isLiveVoicePreview ? "Voice preview live" : "Preview with voice"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewScene((current) => (current + 1) % Math.max(activeProject.scenes.length, 1))}
                    className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
                  >
                    Next scene
                  </button>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {videoLengthPresets.map((preset) => {
                        const activePreset = Math.abs(settings.videoLengthMultiplier - preset.value) < 0.01;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyVideoLengthMultiplier(preset.value, preset.label)}
                            className={`rounded-full px-5 py-3 text-sm font-semibold transition ${activePreset ? "border border-cyan-300/40 bg-cyan-400/20 text-cyan-50" : "border border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"}`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => applyVideoLengthMultiplier(settings.videoLengthMultiplier - 0.25, "Custom")}
                        className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
                      >
                        Decrease length
                      </button>
                      <button
                        type="button"
                        onClick={() => applyVideoLengthMultiplier(settings.videoLengthMultiplier + 0.25, "Custom")}
                        className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
                      >
                        Increase length
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {targetDurationPresets.map((preset) => {
                        const activeTarget = currentTargetDuration === preset.label;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => fitVideoToTargetDuration(preset.seconds)}
                            className={`rounded-full px-5 py-3 text-sm font-semibold transition ${activeTarget ? "border border-fuchsia-300/40 bg-fuchsia-400/20 text-fuchsia-50" : "border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100 hover:bg-fuchsia-400/20"}`}
                          >
                            Auto-fit {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generateVoiceVideo()}
                    className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-5 py-3 text-sm font-semibold text-fuchsia-50 transition hover:bg-fuchsia-300/20"
                  >
                    {isRenderingVideo && settings.voice.includeInVideo ? `Generating voice video ${videoProgress}%` : "Generate video with voice"}
                  </button>
                  <button
                    type="button"
                    onClick={renderVideo}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                  >
                    {isRenderingVideo ? `Rendering ${videoProgress}%` : "Export cinematic video"}
                  </button>
                </div>
              </div>
            </Card>

            <Card title="Project brief" subtitle="Hindi script, hook, caption, CTA, and export controls">
              <div className="space-y-4">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-50">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Active project</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{activeProject.scriptTitle}</h3>
                  <p className="mt-2 text-sm leading-7 text-cyan-100/90">{activeProject.hook}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <MiniStat label="Scenes" value={String(activeProject.scenes.length)} />
                  <MiniStat label="Status" value={activeProject.status} tone={activeProject.exports.video ? "success" : "default"} />
                  <MiniStat label="Length mode" value={`${activeVideoLengthPreset} • ${settings.videoLengthMultiplier.toFixed(2)}x`} tone={settings.videoLengthMultiplier > 1 ? "success" : "default"} />
                  <MiniStat label="Target" value={currentTargetDuration} tone={currentTargetDuration !== "Flexible" ? "success" : "default"} />
                  <MiniStat label="Est. duration" value={`${estimatedVideoDuration.toFixed(1)}s`} tone={estimatedVideoDuration >= 8 ? "success" : "warn"} />
                  <MiniStat label="Voice" value={activeProject.voiceMimeType?.startsWith("audio/") ? "Audio ready" : activeProject.exports.voice ? "Package ready" : isGeneratingVoice ? "Generating" : isPlayingVoice ? "Playing" : "Not generated"} tone={activeProject.exports.voice || isPlayingVoice ? "success" : "default"} />
                </div>
                <div className={`rounded-[1.5rem] border p-4 text-sm leading-7 ${activeProject.exports.video ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-50" : "border-amber-400/20 bg-amber-400/10 text-amber-50"}`}>
                  {activeProject.videoUrl
                    ? `This project has a real generated WebM video ready for preview and download in this browser session. Current target profile: ${currentTargetDuration}.`
                    : activeProject.fallbackVideoUrl
                      ? `Primary video export was not available, so the app generated a fallback cinematic HTML player for this project. You can open it in a new tab or download it. Current target profile: ${currentTargetDuration}.`
                      : isRenderingVideo
                        ? `The app is currently generating a real cinematic video file${settings.voice.includeInVideo ? " with embedded narration" : ""}. Progress: ${videoProgress}%.`
                        : isLiveVoicePreview
                          ? `Real-time voice storyboard preview is running. Scenes are advancing live with narration for this project.`
                          : `This project has a generated storyboard and scene pack. If you changed the length mode, used Decrease/Increase, or applied auto-fit, the previous video was cleared so you can export a fresh cinematic video. Current target profile: ${currentTargetDuration}, estimated duration: ${estimatedVideoDuration.toFixed(1)}s.`}
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Script</p>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">{activeProject.script}</pre>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Caption package</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{activeProject.caption}</p>
                  <p className="mt-3 text-sm text-cyan-200">{activeProject.hashtags.join(" ")}</p>
                </div>
                <div className="rounded-[1.5rem] border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 text-fuchsia-50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-200">Voice generation</p>
                      <p className="mt-2 text-sm leading-7 text-fuchsia-100/90">Generate Hindi narration with Sarvam AI on the secure backend. If Sarvam is unavailable, the app falls back to the browser Hindi voice engine.</p>
                    </div>
                    <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-1 text-xs font-semibold text-fuchsia-100">{sarvamHealth?.ok ? "Sarvam AI" : preferredVoice ? preferredVoice.name : "Default Hindi voice"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-fuchsia-100/80">
                    <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1">Primary: {sarvamHealth?.ok ? "Sarvam secure TTS" : "Unavailable"}</span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Fallback: Browser Hindi voice</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={() => void renderVoiceForProject(activeProject)} className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-5 py-3 text-sm font-semibold text-fuchsia-50 transition hover:bg-fuchsia-300/20">{isGeneratingVoice ? "Generating voice..." : "Generate voice"}</button>
                    <button type="button" onClick={() => previewVoice(activeProject)} className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-fuchsia-300/40 hover:bg-white/10">{isPlayingVoice ? "Voice playing..." : "Preview voice"}</button>
                    <button type="button" onClick={stopVoicePreview} className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-fuchsia-300/40 hover:bg-white/10">Stop voice</button>
                    <button type="button" onClick={() => activeProject.voiceAudioUrl ? downloadUrl(`${activeProject.scriptTitle}-voice${activeProject.voiceMimeType?.includes("json") ? ".json" : activeProject.voiceMimeType?.includes("wav") ? ".wav" : ".audio"}`, activeProject.voiceAudioUrl) : setNotice("Generate voice first.")} className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-5 py-3 text-sm font-semibold text-fuchsia-50 transition hover:bg-fuchsia-300/20">{activeProject.voiceMimeType?.startsWith("audio/") ? "Download voice audio" : "Download voice package"}</button>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-fuchsia-100/80">
                    {settings.voice.includeInVideo
                      ? "Narration is configured to be embedded into the exported video. If no voice exists yet, the renderer will try to generate it automatically before export."
                      : "Narration is currently generated as a separate asset. Enable embedded narration in Settings if you want voice mixed into the exported video."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => downloadScript(activeProject)} className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10">Download script</button>
                  <button type="button" onClick={() => downloadStoryboard(activeProject)} className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10">Download storyboard</button>
                  <button type="button" onClick={() => downloadVideo(activeProject)} className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20">{activeProject.videoUrl ? "Download video" : activeProject.fallbackVideoUrl ? "Download fallback player" : "Download video"}</button>
                  {activeProject.fallbackVideoUrl ? (
                    <button type="button" onClick={() => window.open(activeProject.fallbackVideoUrl, "_blank", "noopener,noreferrer")} className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20">Open fallback player</button>
                  ) : null}
                </div>
                {activeProject.videoUrl ? <video src={activeProject.videoUrl} controls className="w-full rounded-[1.5rem] border border-white/10 bg-slate-950/80" /> : null}
                {activeProject.fallbackVideoUrl ? (
                  <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-50">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">Fallback export ready</p>
                    <p className="mt-2">A playable cinematic HTML export is ready for this project because the primary browser video pipeline was unavailable or failed.</p>
                    <p className="mt-2 text-emerald-100/90">Format: {activeProject.fallbackVideoLabel ?? activeProject.fallbackVideoMimeType ?? "Fallback player"}</p>
                  </div>
                ) : null}
              </div>
            </Card>
          </section>

          <Card title="Scene pack" subtitle="Every cinematic scene image generated for this project">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {activeProject.scenes.map((scene, index) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => setPreviewScene(index)}
                  className={`overflow-hidden rounded-[1.5rem] border text-left transition ${previewScene === index ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/10"}`}
                >
                  <img src={scene.imageUrl} alt={scene.title} className="aspect-[9/16] w-full object-cover" />
                  <div className="p-4">
                    <p className="font-semibold text-white">{scene.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{scene.caption}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card title="Studio empty state" subtitle="Generate a project to unlock the preview studio">
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-400">No active project yet. Open the Generator page and create a Hindi cinematic storyboard first.</div>
        </Card>
      )}
    </div>
  );

  const libraryView = (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content operations"
        title="Library page"
        description="Manage projects, queue publishing jobs, and review the local automation history from one page."
      />

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <Card title="Content library" subtitle="All locally stored cinematic projects">
          <div className="space-y-3">
            {projects.length ? (
              projects.map((project) => (
                <div key={project.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{project.scriptTitle}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatDate(project.createdAt)} • {project.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setProjectAndOpen(project.id)} className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5">Open</button>
                      <button type="button" onClick={() => downloadScript(project)} className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5">Script</button>
                      <button type="button" onClick={() => downloadVideo(project)} className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5">Video</button>
                      <button type="button" onClick={() => removeProject(project.id)} className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-400/20">Delete</button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-400">No projects yet. Generate one from the Generator page.</div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Publish scheduler" subtitle="Queue or publish the active project to a connected platform">
            <div className="space-y-4">
              <label className="space-y-2">
                <FieldLabel>Target platform</FieldLabel>
                <select value={schedulePlatform} onChange={(event) => setSchedulePlatform(event.target.value as PlatformLabel)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none">
                  <option>YouTube Shorts</option>
                  <option>Instagram Reels</option>
                  <option>Facebook Pages</option>
                </select>
              </label>
              <label className="space-y-2">
                <FieldLabel>Schedule time</FieldLabel>
                <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={schedulePublish}
                  className="w-full rounded-full border border-white/15 bg-white/5 px-5 py-3.5 text-center text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10 active:scale-[0.99]"
                >
                  Queue publish
                </button>
                <button
                  type="button"
                  onClick={publishNow}
                  className="w-full rounded-full bg-white px-5 py-3.5 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 active:scale-[0.99]"
                >
                  Publish now
                </button>
              </div>
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  Default route: <span className="font-semibold text-white">{settings.defaultPlatform}</span>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Connected platforms: {connectedCount}/3
                </div>
              </div>
            </div>
          </Card>

          <Card title="Job history" subtitle="Scheduler execution and publishing results">
            <div className="space-y-3">
              {jobs.length ? (
                jobs.map((job) => {
                  const project = projects.find((entry) => entry.id === job.projectId);
                  return (
                    <div key={job.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{project?.scriptTitle ?? "Unknown project"}</p>
                          <p className="mt-1 text-sm text-slate-400">{job.platform} • {formatDate(job.scheduledFor)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${job.status === "published" ? "bg-emerald-300 text-emerald-950" : job.status === "failed" ? "bg-red-300 text-red-950" : "bg-slate-800 text-slate-200"}`}>{job.status}</span>
                      </div>
                      {job.error ? <p className="mt-2 text-sm text-red-200">{job.error}</p> : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-400">No publish jobs yet. Queue one after generating a project.</div>
              )}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );

  const analyticsView = (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance view"
        title="Analytics page"
        description="Track readiness, output throughput, platform connectivity, and collector health in a cleaner metrics-focused page."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Readiness" value={`${readinessScore}%`} tone="success" />
        <MiniStat label="Published" value={String(publishedCount)} tone="success" />
        <MiniStat label="Queued" value={String(queuedCount)} />
        <MiniStat label="Live videos" value={String(liveVideos.length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card title="Operational health" subtitle="Live pipeline indicators and collection confidence">
          <div className="space-y-4">
            <ProgressLine label="Automation state" value={settings.systemActive ? 100 : 20} />
            <ProgressLine label="Collector readiness" value={settings.integrations.youtubeMode === "server-proxy" ? (proxyHealth?.ok ? 100 : 45) : settings.apiKeys.youtube.trim() ? 88 : 30} />
            <ProgressLine label="Publishing readiness" value={Math.round((connectedCount / 3) * 100)} />
            <ProgressLine label="Content output readiness" value={projects.some((project) => project.exports.video) ? 96 : projects.length ? 78 : 32} />
          </div>
        </Card>

        <Card title="Content throughput" subtitle="Project output and scheduling breakdown">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Output summary</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">Projects: {projects.length} • Storyboards ready: {projects.filter((project) => project.exports.scenePack).length} • Videos ready: {projects.filter((project) => project.exports.video).length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Queue summary</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">Scheduled: {jobs.filter((job) => job.status === "scheduled").length} • Published: {jobs.filter((job) => job.status === "published").length} • Failed: {jobs.filter((job) => job.status === "failed").length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Discovery summary</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">Mode: {collectorMode} • Channels discovered: {liveChannels.length} • Region: {settings.integrations.regionCode} • Category: {settings.integrations.categoryId}</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );

  const settingsView = (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System configuration"
        title="Settings page"
        description="Manage AI orchestration keys, connected platforms, storage preferences, and secure workspace controls from one dedicated page."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="System active" value={settings.systemActive ? "Enabled" : "Disabled"} tone={settings.systemActive ? "success" : "warn"} />
        <MiniStat label="Platforms connected" value={`${connectedCount}/3`} tone={connectedCount > 0 ? "success" : "warn"} />
        <MiniStat label="YouTube mode" value={settings.integrations.youtubeMode === "server-proxy" ? "Proxy" : "Direct"} />
        <MiniStat label="Storage" value={settings.storage.provider} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <Card title="Configuration tabs" subtitle="Switch between account, key, auth, and storage controls">
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">System Active</p>
                <p className="text-xs text-emerald-100/80">Enable queue, generation, and publishing actions</p>
              </div>
              <input
                type="checkbox"
                checked={settings.systemActive}
                onChange={(event) => setSettings((current) => ({ ...current, systemActive: event.target.checked }))}
                className="h-4 w-4"
              />
            </label>
            {settingsTabs.map((tab) => (
              <button
                key={tab.title}
                type="button"
                onClick={() => setActiveSettings(tab.title)}
                className={`w-full rounded-[1.5rem] border p-4 text-left transition ${activeSettings === tab.title ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/10"}`}
              >
                <p className="font-semibold text-white">{tab.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{tab.description}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card title={currentSettings.title} subtitle={currentSettings.description}>
          <div className="space-y-6">
            {activeSettings === "Social Accounts" ? (
              <div className="space-y-4">
                <label className="space-y-2">
                  <FieldLabel>Default publish destination</FieldLabel>
                  <select
                    value={settings.defaultPlatform}
                    onChange={(event) => setSettings((current) => ({ ...current, defaultPlatform: event.target.value as PlatformLabel }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  >
                    <option>YouTube Shorts</option>
                    <option>Instagram Reels</option>
                    <option>Facebook Pages</option>
                  </select>
                </label>
                <div className="grid gap-4 md:grid-cols-3">
                  {([
                    ["instagram", "Connect"],
                    ["youtube", "Connect Account"],
                    ["facebook", "Connect"],
                  ] as [PlatformKey, string][]).map(([platform, action]) => {
                    const connected = settings.socialAccounts[platform];
                    return (
                      <div key={platform} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="font-semibold text-white">{platformLabels[platform]}</p>
                        <p className="mt-2 text-sm text-slate-400">{connected ? "Connected" : "Not Connected"}</p>
                        <button type="button" onClick={() => connectPlatform(platform)} className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5">
                          {connected ? "Disconnect" : action}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activeSettings === "API Credentials" ? (
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 text-fuchsia-50">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-200">Voice engine</p>
                  <p className="mt-2 text-sm leading-7 text-fuchsia-100/90">Primary Hindi voice generation runs through secure server-side Sarvam AI TTS. If Sarvam is not configured, the app falls back to browser Speech Synthesis.</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-fuchsia-100/85">
                    <span className={`rounded-full border px-3 py-1 ${sarvamHealth?.ok ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100" : "border-amber-300/30 bg-amber-400/15 text-amber-100"}`}>
                      Sarvam backend: {sarvamHealth?.ok ? "Connected" : sarvamHealth?.reachable === false ? "Unreachable in preview" : "Key missing"}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Browser fallback: {typeof window !== "undefined" && "speechSynthesis" in window ? "Available" : "Unavailable"}</span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {([
                    ["llm", "LLM API key (UI placeholder)"],
                    ["image", "Image API key"],
                    ["storage", "Storage API key"],
                    ["youtube", "YouTube Data API key"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="space-y-2">
                      <FieldLabel>{label}</FieldLabel>
                      <input
                        value={settings.apiKeys[key]}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            apiKeys: { ...current.apiKeys, [key]: event.target.value },
                          }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                      />
                      <p className="text-xs text-slate-500">Masked preview: {maskKey(settings.apiKeys[key])}</p>
                    </label>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center justify-between rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-3 md:col-span-2">
                    <span className="text-sm font-medium text-white">Enable Hindi voice generation</span>
                    <input
                      type="checkbox"
                      checked={settings.voice.enabled}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          voice: { ...current.voice, enabled: event.target.checked },
                        }))
                      }
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="space-y-2">
                    <FieldLabel>Hindi voice</FieldLabel>
                    <select
                      value={settings.voice.selectedVoiceURI}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          voice: { ...current.voice, selectedVoiceURI: event.target.value },
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="">Auto-select Hindi voice</option>
                      {availableVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} • {voice.lang}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <FieldLabel>Include voice in pipeline</FieldLabel>
                    <select
                      value={settings.voice.includeInVideo ? "yes" : "no"}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          voice: { ...current.voice, includeInVideo: event.target.value === "yes" },
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="no">Generate narration separately</option>
                      <option value="yes">Embed narration into exported video</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <FieldLabel>Voice rate</FieldLabel>
                    <input
                      type="range"
                      min="0.7"
                      max="1.2"
                      step="0.05"
                      value={settings.voice.rate}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          voice: { ...current.voice, rate: Number(event.target.value) },
                        }))
                      }
                      className="w-full accent-fuchsia-400"
                    />
                    <p className="text-xs text-slate-500">Current rate: {settings.voice.rate.toFixed(2)}x</p>
                  </label>
                  <label className="space-y-2">
                    <FieldLabel>Voice pitch</FieldLabel>
                    <input
                      type="range"
                      min="0.8"
                      max="1.3"
                      step="0.05"
                      value={settings.voice.pitch}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          voice: { ...current.voice, pitch: Number(event.target.value) },
                        }))
                      }
                      className="w-full accent-fuchsia-400"
                    />
                    <p className="text-xs text-slate-500">Current pitch: {settings.voice.pitch.toFixed(2)}x</p>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <FieldLabel>YouTube fetch mode</FieldLabel>
                    <select
                      value={settings.integrations.youtubeMode}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          integrations: { ...current.integrations, youtubeMode: event.target.value as FetchMode },
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="client-direct">Client direct</option>
                      <option value="server-proxy">Backend secure proxy</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <FieldLabel>Proxy base URL</FieldLabel>
                    <input
                      value={settings.integrations.proxyBaseUrl}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          integrations: { ...current.integrations, proxyBaseUrl: event.target.value },
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                      placeholder="/"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm leading-7 text-red-50">
                  <p className="font-semibold text-white">YouTube integration status</p>
                  <p className="mt-2">{youtubeStatusMessage}</p>
                  <p className="mt-2 text-red-100/80">Vercel recommendation: keep proxy base URL as `/` and set `YOUTUBE_API_KEY` in project environment variables.</p>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-50">
                  <p className="font-semibold text-white">OpenAI storyboard status</p>
                  <p className="mt-2">{openAiStatusMessage}</p>
                  <p className="mt-2 text-cyan-100/80">Vercel recommendation: add `OPENAI_API_KEY` in Project Settings → Environment Variables. Do not place the OpenAI key in frontend fields.</p>
                </div>

                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 text-sm leading-7 text-fuchsia-50">
                  <p className="font-semibold text-white">Sarvam AI voice status</p>
                  <p className="mt-2">{sarvamStatusMessage}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-fuchsia-100/85">
                    <span className={`rounded-full border px-3 py-1 ${sarvamHealth?.ok ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100" : "border-amber-300/30 bg-amber-400/15 text-amber-100"}`}>Provider: {sarvamHealth?.provider || "sarvam"}</span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Model: {sarvamHealth?.model || "bulbul:v2"}</span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Speaker: {sarvamHealth?.speaker || "meera"}</span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Language: {sarvamHealth?.languageCode || "hi-IN"}</span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Sample rate: {sarvamHealth?.sampleRate || 22050} Hz</span>
                  </div>
                  <p className="mt-2 text-fuchsia-100/80">Vercel recommendation: add `SARVAM_API_KEY`, `SARVAM_TTS_MODEL`, `SARVAM_TTS_SPEAKER`, `SARVAM_LANGUAGE_CODE`, and `SARVAM_SAMPLE_RATE` in Project Settings → Environment Variables. Do not place the Sarvam key in frontend fields.</p>
                </div>
              </div>
            ) : null}

            {activeSettings === "Security & Auth" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <FieldLabel>Workspace</FieldLabel>
                  <input
                    value={settings.security.workspace}
                    onChange={(event) => setSettings((current) => ({ ...current, security: { ...current.security, workspace: event.target.value } }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <FieldLabel>Authentication mode</FieldLabel>
                  <select
                    value={settings.security.authMode}
                    onChange={(event) => setSettings((current) => ({ ...current, security: { ...current.security, authMode: event.target.value as Settings["security"]["authMode"] } }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  >
                    <option>Passwordless Link</option>
                    <option>Workspace Password</option>
                    <option>SSO</option>
                  </select>
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm font-medium text-white">Require 2FA</span>
                  <input
                    type="checkbox"
                    checked={settings.security.require2FA}
                    onChange={(event) => setSettings((current) => ({ ...current, security: { ...current.security, require2FA: event.target.checked } }))}
                    className="h-4 w-4"
                  />
                </label>
              </div>
            ) : null}

            {activeSettings === "Storage Settings" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <FieldLabel>Custom video length</FieldLabel>
                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4">
                    <div className="mb-4 flex flex-wrap gap-3">
                      {videoLengthPresets.map((preset) => {
                        const activePreset = Math.abs(settings.videoLengthMultiplier - preset.value) < 0.01;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyVideoLengthMultiplier(preset.value, preset.label)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activePreset ? "border border-cyan-300/40 bg-cyan-400/20 text-cyan-50" : "border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/30 hover:bg-white/10"}`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => applyVideoLengthMultiplier(settings.videoLengthMultiplier - 0.25, "Custom")}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/10"
                      >
                        Decrease
                      </button>
                      <button
                        type="button"
                        onClick={() => applyVideoLengthMultiplier(settings.videoLengthMultiplier + 0.25, "Custom")}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/10"
                      >
                        Increase
                      </button>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-3">
                      {targetDurationPresets.map((preset) => {
                        const activeTarget = currentTargetDuration === preset.label;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => fitVideoToTargetDuration(preset.seconds)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTarget ? "border border-fuchsia-300/40 bg-fuchsia-400/20 text-fuchsia-50" : "border border-white/10 bg-white/5 text-slate-200 hover:border-fuchsia-300/30 hover:bg-white/10"}`}
                          >
                            Auto-fit {preset.label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="range"
                      min={String(VIDEO_LENGTH_MIN)}
                      max={String(VIDEO_LENGTH_MAX)}
                      step="0.25"
                      value={settings.videoLengthMultiplier}
                      onChange={(event) => applyVideoLengthMultiplier(Number(event.target.value), "Custom")}
                      className="w-full accent-cyan-300"
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
                      <span>Current length: <span className="font-semibold text-white">{settings.videoLengthMultiplier.toFixed(2)}x</span></span>
                      <span>Target profile: <span className="font-semibold text-white">{currentTargetDuration}</span> • Use 15s / 30s / 60s buttons to auto-fit all scenes to a total duration.</span>
                    </div>
                  </div>
                </label>
                <label className="space-y-2">
                  <FieldLabel>Storage provider</FieldLabel>
                  <select
                    value={settings.storage.provider}
                    onChange={(event) => setSettings((current) => ({ ...current, storage: { ...current.storage, provider: event.target.value as Settings["storage"]["provider"] } }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  >
                    <option>Local Browser Vault</option>
                    <option>Amazon S3</option>
                    <option>Cloudflare R2</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <FieldLabel>Retention policy</FieldLabel>
                  <select
                    value={settings.storage.retention}
                    onChange={(event) => setSettings((current) => ({ ...current, storage: { ...current.storage, retention: event.target.value as Settings["storage"]["retention"] } }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  >
                    <option>7 days</option>
                    <option>30 days</option>
                    <option>90 days</option>
                  </select>
                </label>
                <label className="space-y-2 md:col-span-2">
                  <FieldLabel>Export folder</FieldLabel>
                  <input
                    value={settings.storage.folder}
                    onChange={(event) => setSettings((current) => ({ ...current, storage: { ...current.storage, folder: event.target.value } }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              {currentSettings.highlights.map((highlight) => (
                <div key={highlight} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  {highlight}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );

  const verifyView = (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verification"
        title="Verify page"
        description="Check the real working status of the MVP, the active architecture, and the recommended deployment pattern."
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card title="Working MVP verification" subtitle="What this application genuinely does in code right now">
          <div className="space-y-3">
            {verificationChecks.map((check) => (
              <div key={check.item} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-white">{check.item}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${check.status === "Working" ? "bg-emerald-300 text-emerald-950" : "bg-amber-300 text-amber-950"}`}>{check.status}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-400">{check.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Architecture and deployment" subtitle="How the page-wise studio is structured for Vercel-friendly delivery">
          <div className="space-y-4 text-sm leading-7 text-slate-300">
            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 font-mono text-xs text-slate-300 sm:text-sm">
              YouTube Search / Trending / Channel Discovery → Topic Analyzer → Hindi Script Generator → Cinematic Scene SVG Generator → Canvas Image-Video Export → Local Scheduler → Content Library
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Frontend</p>
                <p className="mt-2 font-semibold text-white">React + Vite page-wise SPA</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Media runtime</p>
                <p className="mt-2 font-semibold text-white">Canvas + MediaRecorder</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">YouTube mode</p>
                <p className="mt-2 font-semibold text-white">{settings.integrations.youtubeMode === "server-proxy" ? "Serverless proxy" : "Client direct"}</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-100">
              Vercel deployment path: build the Vite frontend, keep YouTube requests behind same-origin serverless `/api` routes, and store `YOUTUBE_API_KEY` in Vercel environment variables.
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">Next backend milestone</p>
              <p className="mt-2 text-sm leading-7 text-slate-400">Add OAuth social publishing, durable backend job persistence, object storage, and heavy media processing workers for fully automated platform uploads.</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case "flow":
        return flowView;
      case "generator":
        return generatorView;
      case "studio":
        return studioView;
      case "library":
        return libraryView;
      case "analytics":
        return analyticsView;
      case "settings":
        return settingsView;
      case "verify":
        return verifyView;
      default:
        return dashboardView;
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-5%] top-24 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(15,23,42,0.3),rgba(2,6,23,1))]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-4">
            <button
              type="button"
              onClick={() => navigate("dashboard")}
              className="flex items-center gap-4 rounded-2xl border border-transparent px-1 py-1 text-left transition hover:border-cyan-300/20 hover:bg-white/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300 via-cyan-400 to-indigo-500 text-slate-950 shadow-[0_14px_30px_rgba(34,211,238,0.28)]">
                <span className="text-lg font-black">B</span>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-white">bamania auto forge AI</p>
                <p className="text-xs text-slate-400">Multi-page cinematic content operations studio</p>
              </div>
            </button>

            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm text-slate-300 lg:flex">
              <button
                type="button"
                onClick={() => navigate("dashboard")}
                className={`rounded-full px-4 py-2 font-semibold transition ${activePage === "dashboard" ? "bg-cyan-300 text-slate-950" : "border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"}`}
              >
                Home Dashboard
              </button>
              {navItems.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => navigate(page)}
                  className={`rounded-full px-4 py-2 transition ${activePage === page ? "bg-white text-slate-950" : "hover:bg-white/10 hover:text-white"}`}
                >
                  {pageLabels[page]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className={`hidden rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] lg:inline-flex ${activePipelineTone}`}>{activePipelineLabel}</span>
              <button
                type="button"
                onClick={() => navigate("dashboard")}
                className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 md:hidden"
              >
                Home
              </button>
              <select
                value={activePage}
                onChange={(event) => navigate(event.target.value as AppPage)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 outline-none transition hover:border-cyan-300/50 md:hidden"
              >
                {navItems.map((page) => (
                  <option key={page} value={page}>
                    {pageLabels[page]}
                  </option>
                ))}
              </select>
              {session ? (
                <button
                  type="button"
                  onClick={() => {
                    setSession(null);
                    setNotice("Signed out of the local MVP session.");
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  {session.email}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSignIn(true)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">Current page</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold tracking-tight text-white">{pageLabels[activePage]}</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">{routeHref(activePage)}</span>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">{pageDescriptions[activePage]}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-300">
              Route-aware navigation enabled for a cleaner multi-page app experience.
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(10,15,30,0.35)] backdrop-blur-2xl">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Workspace</p>
              <p className="mt-2 font-semibold text-white">{session?.workspace ?? settings.security.workspace}</p>
              <p className="mt-1 text-sm text-slate-400">{session?.email ?? "Local studio session"}</p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate("dashboard")}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${activePage === "dashboard" ? "bg-cyan-300 text-slate-950" : "border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"}`}
              >
                <div>
                  <span className="block">Home</span>
                  <span className={`mt-1 block text-[11px] ${activePage === "dashboard" ? "text-slate-700" : "text-cyan-200/80"}`}>{routeHref("dashboard")}</span>
                </div>
                {activePage === "dashboard" ? <span className="text-xs font-semibold">Active</span> : null}
              </button>
              {navItems.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => navigate(page)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${activePage === page ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:bg-white/10"}`}
                >
                  <div>
                    <span className="block">{pageLabels[page]}</span>
                    <span className={`mt-1 block text-[11px] ${activePage === page ? "text-slate-700" : "text-slate-500"}`}>{routeHref(page)}</span>
                  </div>
                  {activePage === page ? <span className="text-xs font-semibold">Active</span> : null}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">System note</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{notice}</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">{renderPage()}</main>
      </div>

      {showSignIn ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Secure Access</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Sign In to bamania auto forge AI</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Authenticate locally to manage workflows, keys, publishing destinations, and system configuration.</p>
              </div>
              <button type="button" onClick={() => setShowSignIn(false)} className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 transition hover:bg-white/5">
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="space-y-2">
                <FieldLabel>Email</FieldLabel>
                <input value={signInEmail} onChange={(event) => setSignInEmail(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <label className="space-y-2">
                <FieldLabel>Workspace</FieldLabel>
                <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <label className="space-y-2">
                <FieldLabel>Authentication Method</FieldLabel>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white">{settings.security.authMode}</div>
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  const nextSession = {
                    email: signInEmail.trim() || "founder@bamaniaautoforge.ai",
                    workspace: workspaceName.trim() || settings.security.workspace,
                  };
                  setSession(nextSession);
                  setShowSignIn(false);
                  setNotice(`Signed in as ${nextSession.email}.`);
                }}
                className="flex-1 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Continue Sign In
              </button>
              <button type="button" onClick={() => setShowSignIn(false)} className="flex-1 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/5">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
