import type { ArtViewerState } from "@/lib/art-viewer-state";

/**
 * Pages whose HTML is shared between visitors (the prerendered home page, and the root layout every
 * page sits in) never read the session on the server. The browser reads the visitor from these two
 * endpoints instead and redraws what depends on them.
 */
export const ART_VIEWER_CHROME_PATH = "/api/viewer";
export const ART_VIEWER_FAVOURITES_PATH = "/api/viewer/favourites";

/** Personal answers: never stored by the browser cache, a CDN or a shared proxy. */
export const ART_VIEWER_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" } as const;

/** The account chrome: header account entry, bottom bar, footer Account list. */
export type ArtViewerChromeSnapshot = {
  account: ArtViewerState;
  /** A gallery reply to an enquiry is waiting (dot on Account). */
  replyDot: boolean;
};

/** A signed-in visitor's saved artworks and followed artists, to seed hearts and Follow buttons. */
export type ArtViewerFavouritesSnapshot = {
  savedArtworkSlugs: string[];
  followedArtistSlugs: string[];
};

const ACCOUNT_KINDS = new Set<ArtViewerState["kind"]>([
  "guest",
  "authenticated",
  "disabled",
  "unavailable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** The endpoint is our own; this only guards against a proxy page or a half-written body. */
export function parseArtViewerChromeSnapshot(body: unknown): ArtViewerChromeSnapshot | null {
  if (!isRecord(body) || !isRecord(body.account) || typeof body.replyDot !== "boolean") return null;
  const kind = body.account.kind as ArtViewerState["kind"];
  if (!ACCOUNT_KINDS.has(kind)) return null;
  return { account: body.account as ArtViewerState, replyDot: body.replyDot };
}

export function parseArtViewerFavouritesSnapshot(
  body: unknown,
): ArtViewerFavouritesSnapshot | null {
  if (!isRecord(body)) return null;
  const { savedArtworkSlugs, followedArtistSlugs } = body;
  if (!isStringArray(savedArtworkSlugs) || !isStringArray(followedArtistSlugs)) return null;
  return { savedArtworkSlugs, followedArtistSlugs };
}

/** Never rejects: a failed or malformed read gives null, and the page keeps what it drew. */
async function readJson<T>(
  path: string,
  parse: (body: unknown) => T | null,
  signal?: AbortSignal,
): Promise<T | null> {
  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return null;
    return parse(await response.json());
  } catch {
    return null;
  }
}

export function readArtViewerChrome(signal?: AbortSignal) {
  return readJson(ART_VIEWER_CHROME_PATH, parseArtViewerChromeSnapshot, signal);
}

export function readArtViewerFavourites(signal?: AbortSignal) {
  return readJson(ART_VIEWER_FAVOURITES_PATH, parseArtViewerFavouritesSnapshot, signal);
}
