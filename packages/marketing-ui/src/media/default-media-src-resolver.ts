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
