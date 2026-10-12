/** Returns the lax.art draft preview URL, or null when the storefront origin is not configured. */
export function buildEditorialPreviewUrl(
  artPublicUrl: string | null | undefined,
  token: string,
): string | null {
  const origin = artPublicUrl?.trim().replace(/\/+$/, "");
  if (!origin) return null;
  return `${origin}/preview/${encodeURIComponent(token)}`;
}
