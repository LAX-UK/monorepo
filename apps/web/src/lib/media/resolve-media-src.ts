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
 *     producing a fully qualified CDN URL.
 *
 * If `NEXT_PUBLIC_MEDIA_BASE_URL` is not configured we leave the value as-is
 * so behaviour matches the pre-helper code path (broken in prod, but the only
 * safe default — silently prefixing with a wrong origin would be worse).
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
    return trimmed;
  }

  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, "");
  if (!base) return trimmed;
  const key = trimmed.replace(/^\/+/, "");
  return `${base}/${key}`;
}
