export type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration?: string;
  regionCode?: string;
  categoryId?: string;
};

export type YouTubeChannel = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
};

export type FetchMode = "server-proxy" | "client-direct";

export type YouTubeCollectorOptions = {
  query?: string;
  apiKey?: string;
  maxResults?: number;
  regionCode?: string;
  relevanceLanguage?: string;
  videoCategoryId?: string;
  mode?: FetchMode;
  proxyBaseUrl?: string;
  publishedAfter?: string;
};

export type LiveTopicSeed = {
  title: string;
  source: "YouTube";
  freshness: number;
  velocity: number;
  commercial: number;
  keywords: string[];
  angle: string;
  notes: string;
  videoId: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration?: string;
  regionCode?: string;
  categoryId?: string;
};

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export const youtubeRegions = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "JP", label: "Japan" },
  { code: "BR", label: "Brazil" },
] as const;

export const youtubeCategories = [
  { id: "0", label: "All categories" },
  { id: "1", label: "Film & Animation" },
  { id: "2", label: "Autos & Vehicles" },
  { id: "10", label: "Music" },
  { id: "15", label: "Pets & Animals" },
  { id: "17", label: "Sports" },
  { id: "19", label: "Travel & Events" },
  { id: "20", label: "Gaming" },
  { id: "22", label: "People & Blogs" },
  { id: "23", label: "Comedy" },
  { id: "24", label: "Entertainment" },
  { id: "25", label: "News & Politics" },
  { id: "26", label: "Howto & Style" },
  { id: "27", label: "Education" },
  { id: "28", label: "Science & Technology" },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseCount(value?: string | number) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAgeInDays(publishedAt?: string) {
  if (!publishedAt) return 14;
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return 14;
  const diff = Date.now() - published;
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}

function extractKeywords(title: string, query = "") {
  const words = `${title} ${query}`
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9\u0900-\u097f]/g, ""))
    .filter((word) => word.length > 2);

  const stopwords = new Set([
    "this",
    "that",
    "with",
    "from",
    "your",
    "will",
    "have",
    "into",
    "about",
    "after",
    "before",
    "their",
    "they",
    "them",
    "what",
    "when",
    "where",
    "which",
    "while",
    "how",
    "why",
    "just",
    "than",
    "then",
    "also",
    "video",
    "shorts",
    "short",
    "youtube",
  ]);

  return Array.from(new Set(words.filter((word) => !stopwords.has(word)))).slice(0, 6);
}

function inferCommercial(title: string, query = "") {
  const text = `${title} ${query}`.toLowerCase();
  const commercialTerms = [
    "ai",
    "automation",
    "business",
    "marketing",
    "startup",
    "tools",
    "workflow",
    "growth",
    "money",
    "productivity",
    "agency",
    "content",
  ];

  const hits = commercialTerms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
  return clamp(58 + hits * 7, 52, 96);
}

function inferAngle(title: string, query = "", channelTitle = "") {
  const primary = extractKeywords(title, query).slice(0, 3).join(", ");
  return `Use ${title.toLowerCase()}${channelTitle ? ` from ${channelTitle}` : ""} as a live proof point for an automation workflow, then build a short-form breakdown around ${primary || query.toLowerCase()}.`;
}

function pickThumbnail(snippet?: { thumbnails?: Record<string, { url?: string }> }) {
  return (
    snippet?.thumbnails?.maxres?.url ||
    snippet?.thumbnails?.standard?.url ||
    snippet?.thumbnails?.high?.url ||
    snippet?.thumbnails?.medium?.url ||
    snippet?.thumbnails?.default?.url ||
    ""
  );
}

function normalizeVideo(item: {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}, regionCode?: string, categoryId?: string): YouTubeVideo {
  return {
    id: item.id || "",
    title: item.snippet?.title || "Untitled YouTube video",
    description: item.snippet?.description || "",
    publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
    channelId: item.snippet?.channelId || "",
    channelTitle: item.snippet?.channelTitle || "Unknown channel",
    thumbnailUrl: pickThumbnail(item.snippet),
    viewCount: parseCount(item.statistics?.viewCount),
    likeCount: parseCount(item.statistics?.likeCount),
    commentCount: parseCount(item.statistics?.commentCount),
    duration: item.contentDetails?.duration,
    regionCode,
    categoryId,
  };
}

function normalizeChannel(item: {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  statistics?: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
  };
}): YouTubeChannel {
  return {
    id: item.id || "",
    title: item.snippet?.title || "Unknown channel",
    description: item.snippet?.description || "",
    thumbnailUrl: pickThumbnail(item.snippet),
    subscriberCount: parseCount(item.statistics?.subscriberCount),
    videoCount: parseCount(item.statistics?.videoCount),
    viewCount: parseCount(item.statistics?.viewCount),
  };
}

function normalizeVideoToTopic(video: YouTubeVideo, query = ""): LiveTopicSeed {
  const ageInDays = getAgeInDays(video.publishedAt);
  const freshness = clamp(Math.round(96 - ageInDays * 8), 54, 98);
  const velocity = clamp(
    Math.round(48 + Math.log10(Math.max(video.viewCount, 1)) * 10 + Math.log10(Math.max(video.commentCount + video.likeCount, 1)) * 7),
    50,
    99,
  );
  const commercial = inferCommercial(video.title, query);
  const keywords = extractKeywords(video.title, query);

  return {
    title: video.title,
    source: "YouTube",
    freshness,
    velocity,
    commercial,
    keywords,
    angle: inferAngle(video.title, query, video.channelTitle),
    notes: `Live YouTube topic from ${video.channelTitle}. Views: ${video.viewCount.toLocaleString()}, likes: ${video.likeCount.toLocaleString()}, comments: ${video.commentCount.toLocaleString()}.`,
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

async function requestJson(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed with ${response.status}`);
  }
  return data;
}

function getDefaultProxyBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "https://localhost";
}

function buildProxyUrl(path: string, params: Record<string, string | number | undefined>, proxyBaseUrl = getDefaultProxyBaseUrl()) {
  const url = new URL(path, proxyBaseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function buildDirectUrl(path: string, params: Record<string, string | number | undefined>, apiKey: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("key", apiKey);
  return url.toString();
}

export async function fetchYouTubeProxyHealth(proxyBaseUrl = getDefaultProxyBaseUrl()) {
  return requestJson(buildProxyUrl("/api/youtube/health", {}, proxyBaseUrl));
}

export async function fetchYouTubeSearchVideos(options: YouTubeCollectorOptions): Promise<YouTubeVideo[]> {
  const {
    query = "AI automation",
    apiKey = "",
    maxResults = 10,
    regionCode = "US",
    relevanceLanguage = "en",
    videoCategoryId = "28",
    mode = "client-direct",
    proxyBaseUrl = getDefaultProxyBaseUrl(),
    publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  } = options;

  if (mode === "server-proxy") {
    const data = await requestJson(
      buildProxyUrl(
        "/api/youtube/search",
        { q: query, maxResults, regionCode, relevanceLanguage, videoCategoryId, publishedAfter },
        proxyBaseUrl,
      ),
    );

    return (data.items || []).map((item: any) => normalizeVideo(item, regionCode, videoCategoryId));
  }

  if (!apiKey.trim()) {
    throw new Error("Missing YouTube API key");
  }

  const searchData = await requestJson(
    buildDirectUrl(
      "search",
      {
        part: "snippet",
        type: "video",
        order: "viewCount",
        q: query,
        maxResults,
        regionCode,
        relevanceLanguage,
        videoCategoryId: videoCategoryId === "0" ? undefined : videoCategoryId,
        publishedAfter,
        safeSearch: "moderate",
      },
      apiKey,
    ),
  );

  const ids = Array.from(new Set((searchData.items || []).map((item: any) => item?.id?.videoId).filter(Boolean)));
  if (!ids.length) return [];

  const statsData = await requestJson(
    buildDirectUrl(
      "videos",
      {
        part: "snippet,statistics,contentDetails",
        id: ids.join(","),
      },
      apiKey,
    ),
  );

  return (statsData.items || []).map((item: any) => normalizeVideo(item, regionCode, videoCategoryId));
}

export async function fetchYouTubeTrendingVideos(options: YouTubeCollectorOptions): Promise<YouTubeVideo[]> {
  const {
    apiKey = "",
    maxResults = 10,
    regionCode = "US",
    videoCategoryId = "28",
    mode = "client-direct",
    proxyBaseUrl = getDefaultProxyBaseUrl(),
  } = options;

  if (mode === "server-proxy") {
    const data = await requestJson(
      buildProxyUrl("/api/youtube/trending", { maxResults, regionCode, videoCategoryId }, proxyBaseUrl),
    );
    return (data.items || []).map((item: any) => normalizeVideo(item, regionCode, videoCategoryId));
  }

  if (!apiKey.trim()) {
    throw new Error("Missing YouTube API key");
  }

  const data = await requestJson(
    buildDirectUrl(
      "videos",
      {
        part: "snippet,statistics,contentDetails",
        chart: "mostPopular",
        regionCode,
        videoCategoryId: videoCategoryId === "0" ? undefined : videoCategoryId,
        maxResults,
      },
      apiKey,
    ),
  );

  return (data.items || []).map((item: any) => normalizeVideo(item, regionCode, videoCategoryId));
}

export async function fetchYouTubeChannels(options: YouTubeCollectorOptions): Promise<YouTubeChannel[]> {
  const {
    query = "AI automation",
    apiKey = "",
    maxResults = 8,
    regionCode = "US",
    mode = "client-direct",
    proxyBaseUrl = getDefaultProxyBaseUrl(),
  } = options;

  if (mode === "server-proxy") {
    const data = await requestJson(buildProxyUrl("/api/youtube/channel", { q: query, maxResults, regionCode }, proxyBaseUrl));
    return (data.items || []).map((item: any) => normalizeChannel(item));
  }

  if (!apiKey.trim()) {
    throw new Error("Missing YouTube API key");
  }

  const searchData = await requestJson(
    buildDirectUrl(
      "search",
      {
        part: "snippet",
        type: "channel",
        q: query,
        maxResults,
        regionCode,
      },
      apiKey,
    ),
  );

  const channelIds = Array.from(new Set((searchData.items || []).map((item: any) => item?.id?.channelId).filter(Boolean)));
  if (!channelIds.length) return [];

  const data = await requestJson(
    buildDirectUrl(
      "channels",
      {
        part: "snippet,statistics,brandingSettings",
        id: channelIds.join(","),
      },
      apiKey,
    ),
  );

  return (data.items || []).map((item: any) => normalizeChannel(item));
}

export async function fetchYouTubeChannelVideos(options: YouTubeCollectorOptions & { channelId: string }): Promise<YouTubeVideo[]> {
  const {
    channelId,
    apiKey = "",
    maxResults = 8,
    regionCode = "US",
    mode = "client-direct",
    proxyBaseUrl = getDefaultProxyBaseUrl(),
  } = options;

  if (mode === "server-proxy") {
    const data = await requestJson(
      buildProxyUrl("/api/youtube/channel-videos", { channelId, maxResults, regionCode }, proxyBaseUrl),
    );
    return (data.items || []).map((item: any) => normalizeVideo(item, regionCode, undefined));
  }

  if (!apiKey.trim()) {
    throw new Error("Missing YouTube API key");
  }

  const searchData = await requestJson(
    buildDirectUrl(
      "search",
      {
        part: "snippet",
        type: "video",
        order: "date",
        channelId,
        maxResults,
        regionCode,
      },
      apiKey,
    ),
  );

  const ids = Array.from(new Set((searchData.items || []).map((item: any) => item?.id?.videoId).filter(Boolean)));
  if (!ids.length) return [];

  const data = await requestJson(
    buildDirectUrl(
      "videos",
      {
        part: "snippet,statistics,contentDetails",
        id: ids.join(","),
      },
      apiKey,
    ),
  );

  return (data.items || []).map((item: any) => normalizeVideo(item, regionCode, undefined));
}

export async function fetchYouTubeTrendSeeds(options: YouTubeCollectorOptions): Promise<LiveTopicSeed[]> {
  const videos = await fetchYouTubeSearchVideos(options);
  return Array.from(new Map(videos.map((video) => [video.title.toLowerCase(), normalizeVideoToTopic(video, options.query || "")])).values()).slice(0, 8);
}

export async function fetchYouTubeTrendingTopicSeeds(options: YouTubeCollectorOptions): Promise<LiveTopicSeed[]> {
  const videos = await fetchYouTubeTrendingVideos(options);
  return Array.from(new Map(videos.map((video) => [video.title.toLowerCase(), normalizeVideoToTopic(video, options.query || "trending")])).values()).slice(0, 8);
}
