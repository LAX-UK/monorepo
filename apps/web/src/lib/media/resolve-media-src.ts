/**
 * Resolve a media src value (URL, root-relative path, data/blob URL, or bare
 * object key) to something `next/image` will accept.
 *
 * Backend persists Spaces object keys (e.g. `uploads/pending/lots/.../foo.jpg`).
 * `next/image` rejects bare keys with 400; it expects either:
 *   - an absolute URL whose hostname is in `remotePatterns`, or
 *   - a root-relative path served from `public/`.
 *
 * This helper:
 *   - returns `null` for empty / nullish input;
 *   - passes through absolute URLs (`http(s)://`), data/blob URLs, and
 *     root-relative paths unchanged;
 *   - prefixes everything else with `NEXT_PUBLIC_MEDIA_BASE_URL` when set,
 *     producing a fully qualified CDN URL;
 *   - returns `null` when the resolved value is not a valid `next/image` src
 *     (e.g. bare object keys with no media base configured).
 */
export function resolveMediaSrc(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  ) {
    return isNextImageSrc(trimmed) ? trimmed : null;
  }

  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, "");
  if (!base) return null;

  const key = trimmed.replace(/^\/+/, "");
  const resolved = `${base}/${key}`;
  return isNextImageSrc(resolved) ? resolved : null;
}

/** Whether `next/image` can load this src without throwing on URL construction. */
function isNextImageSrc(value: string): boolean {
  if (value.startsWith("/")) return true;
  if (value.startsWith("data:") || value.startsWith("blob:")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
