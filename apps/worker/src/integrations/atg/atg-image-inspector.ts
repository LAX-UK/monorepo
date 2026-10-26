/** What the media origin reports for an image URL; nulls when it could not be determined. */
export type AtgImageFacts = {
  contentType: string | null;
  bytes: number | null;
  /** Set when the check itself failed (network error, non-2xx). */
  error: string | null;
};

/** Port for checking an image before ATG is asked to fetch it. */
export interface AtgImageInspector {
  inspect(url: string): Promise<AtgImageFacts>;
}

/** ATG accepts JPG images under 10 MB. */
export const ATG_MAX_IMAGE_BYTES = 10_000_000;

/** Null when ATG will accept the image, otherwise why not. */
export function atgImageProblem(facts: AtgImageFacts): string | null {
  if (facts.error) return `couldn't be checked (${facts.error})`;
  if (facts.contentType !== "image/jpeg") {
    return `must be a JPG (is ${facts.contentType ?? "an unknown type"})`;
  }
  if (facts.bytes == null) return "has an unknown size";
  if (facts.bytes >= ATG_MAX_IMAGE_BYTES) {
    return `must be under 10 MB (is ${(facts.bytes / 1_000_000).toFixed(1)} MB)`;
  }
  return null;
}

type FetchLike = typeof fetch;

/** `HEAD`s the public media URL, the same URL ATG will download. */
export class HttpAtgImageInspector implements AtgImageInspector {
  constructor(
    private readonly timeoutMs = 10_000,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async inspect(url: string): Promise<AtgImageFacts> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      return { contentType: null, bytes: null, error: err instanceof Error ? err.name : "error" };
    }
    if (!res.ok) return { contentType: null, bytes: null, error: `HTTP ${res.status}` };
    const type = res.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() || null;
    const length = Number(res.headers.get("content-length"));
    return {
      contentType: type,
      bytes: Number.isFinite(length) && length > 0 ? length : null,
      error: null,
    };
  }
}
