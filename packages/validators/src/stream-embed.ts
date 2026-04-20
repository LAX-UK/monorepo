/** Whitelisted streaming hosts for sale.streamUrl (defense in depth with zod + embed builder). */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com"]);

/** Vimeo iframe host — admins may paste embed URLs directly. */
const VIMEO_PLAYER_HOST = "player.vimeo.com";

const TWITCH_HOSTS = new Set(["twitch.tv", "www.twitch.tv"]);

const CLOUDFLARE_STREAM_HOST = /\.cloudflarestream\.com$/i;

export type StreamEmbedProvider = "youtube" | "vimeo" | "twitch" | "cloudflare";

export type StreamEmbedResult = {
  /** iframe src (Twitch may omit parent=; caller appends for embed) */
  src: string;
  provider: StreamEmbedProvider;
  /** YouTube 11-char id when provider is youtube */
  videoId?: string | undefined;
  /** YouTube start offset in seconds (from `t` or `start` query) */
  startSeconds?: number | undefined;
};

function extractYoutubeId(pathname: string, search: string, host: string): string | null {
  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = pathname.split("/").filter(Boolean)[0];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (pathname === "/watch" || pathname.startsWith("/watch")) {
    const v = new URLSearchParams(search).get("v");
    return v && /^[\w-]{11}$/.test(v) ? v : null;
  }
  if (pathname.startsWith("/embed/")) {
    const id = pathname.slice("/embed/".length).split("/")[0];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (pathname.startsWith("/live/")) {
    const id = pathname.slice("/live/".length).split("/")[0];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }
  return null;
}

/** Parse `?t=11s`, `?t=11`, or `?start=90` from a YouTube watch / short URL query string. */
export function parseYoutubeStartSeconds(search: string): number | undefined {
  const params = new URLSearchParams(search);
  const start = params.get("start");
  if (start != null && start !== "") {
    const n = Number.parseInt(start, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const t = params.get("t");
  if (t == null || t === "") return undefined;
  const trimmed = t.trim();
  const simple = /^(\d+)(s)?$/i.exec(trimmed);
  if (simple?.[1]) {
    const n = Number.parseInt(simple[1], 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

function extractVimeoId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const id = parts[0];
  return id && /^\d+$/.test(id) ? id : null;
}

function extractTwitchChannel(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg || ["videos", "clip", "directory", "downloads", "settings"].includes(seg.toLowerCase())) {
    return null;
  }
  return /^[a-zA-Z0-9_]{2,25}$/.test(seg) ? seg.toLowerCase() : null;
}

/** True if URL host is allowed for streamUrl storage (not necessarily embeddable). */
export function isAllowedStreamUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (
      YOUTUBE_HOSTS.has(host) ||
      VIMEO_HOSTS.has(host) ||
      host === VIMEO_PLAYER_HOST ||
      TWITCH_HOSTS.has(host)
    )
      return true;
    if (CLOUDFLARE_STREAM_HOST.test(host) && host.startsWith("customer-")) return true;
    if (host === "iframe.mediadelivery.net") return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Build a safe embed src for whitelisted providers. Returns null if URL is not embeddable.
 * Twitch src omits parent= — append in the client: `${src}&parent=${host}` (repeat parent for multiple domains if needed).
 */
export function parseStreamEmbedUrl(raw: string): StreamEmbedResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const pathname = u.pathname;

  if (YOUTUBE_HOSTS.has(host)) {
    const id = extractYoutubeId(pathname, u.search, host);
    if (!id) return null;
    const startSeconds = parseYoutubeStartSeconds(u.search);
    const base = `https://www.youtube.com/embed/${id}?rel=0`;
    const src =
      startSeconds !== undefined ? `${base}&start=${startSeconds}` : base;
    return {
      provider: "youtube",
      src,
      videoId: id,
      ...(startSeconds !== undefined ? { startSeconds } : {}),
    };
  }

  if (host === VIMEO_PLAYER_HOST) {
    const fromVideo = pathname.match(/^\/video\/(\d+)/);
    const fromEmbed = pathname.match(/^\/embed\/(\d+)/);
    const id = fromVideo?.[1] ?? fromEmbed?.[1] ?? null;
    if (!id) return null;
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${id}` };
  }

  if (VIMEO_HOSTS.has(host)) {
    const id = extractVimeoId(pathname);
    if (!id) return null;
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${id}` };
  }

  if (TWITCH_HOSTS.has(host)) {
    const channel = extractTwitchChannel(pathname);
    if (!channel) return null;
    return {
      provider: "twitch",
      src: `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&muted=false`,
    };
  }

  if (host === "iframe.mediadelivery.net" && pathname.includes("/")) {
    /** Strip query string — only origin + pathname (UID path) is trusted. */
    const canonical = `${u.protocol}//${u.host}${u.pathname}`;
    return { provider: "cloudflare", src: canonical };
  }

  if (CLOUDFLARE_STREAM_HOST.test(host) && host.startsWith("customer-")) {
    if (pathname.includes("/iframe") || pathname.match(/\/[a-f0-9-]{36}\//i)) {
      const canonical = `${u.protocol}//${u.host}${u.pathname}`;
      return { provider: "cloudflare", src: canonical };
    }
  }

  return null;
}
