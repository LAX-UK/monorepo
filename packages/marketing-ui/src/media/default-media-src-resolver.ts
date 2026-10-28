/** Pass-through resolver for absolute, root-relative, data:, and blob: URLs. */
export type MediaSrcResolver = (src: string | null | undefined) => string | null;

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

export const defaultMediaSrcResolver: MediaSrcResolver = (value) => {
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

  return null;
};

/** Runs a host app's stored-URL rules first, then the same safety checks as the default. */
export function mediaSrcResolverFrom(
  resolve: (src: string | null | undefined) => string | null,
): MediaSrcResolver {
  return (value) => defaultMediaSrcResolver(resolve(value));
}

/**
 * A source the resolver rewrote now points at another origin (the storefront that owns the
 * seed image), which Next's image optimiser has no allowlist entry for, so it loads as is.
 */
export function isRewrittenMediaSrc(original: string | null | undefined, resolved: string | null) {
  return resolved !== null && resolved !== original?.trim();
}
