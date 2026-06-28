import { isSafePublicHttpUrl } from "./safe-public-url.js";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 512_000;
const USER_AGENT = "LAXBot/1.0 (+https://lax.bid/press)";

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    const first = chunks[0];
    if (first) return first;
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

const META_TAG =
  /<meta\b[^>]*(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]*>/gi;

function readMetaContent(tag: string): string | null {
  const contentMatch = tag.match(/\bcontent=["']([^"']+)["']/i);
  return contentMatch?.[1]?.trim() ?? null;
}

function resolvePreviewImageUrl(raw: string, pageUrl: URL): string | null {
  try {
    const resolved = new URL(raw.trim(), pageUrl);
    if (!isSafePublicHttpUrl(resolved.href)) return null;
    return resolved.href;
  } catch {
    return null;
  }
}

export function extractOpenGraphImageUrl(html: string, pageUrl: URL): string | null {
  for (const tag of html.match(META_TAG) ?? []) {
    const content = readMetaContent(tag);
    if (!content) continue;
    const resolved = resolvePreviewImageUrl(content, pageUrl);
    if (resolved) return resolved;
  }
  return null;
}

export type FetchOpenGraphImageOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

/** Fetches a public article URL and returns its og:image / twitter:image when present. */
export async function fetchOpenGraphImage(
  articleUrl: string,
  options: FetchOpenGraphImageOptions = {},
): Promise<string | null> {
  if (!isSafePublicHttpUrl(articleUrl)) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    const response = await fetchImpl(articleUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT,
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
    }
    await reader.cancel();

    const html = new TextDecoder("utf-8", { fatal: false }).decode(concatBytes(chunks));
    return extractOpenGraphImageUrl(html, new URL(response.url || articleUrl));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
