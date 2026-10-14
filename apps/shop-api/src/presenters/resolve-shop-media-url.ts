import type { ObjectStoragePort } from "@auction/object-storage";

/**
 * Maps a stored media key or absolute URL to a public catalogue URL.
 * Root-relative values (`/art/seed/...`) are storefront assets, never storage keys.
 */
export function resolveShopMediaPublicUrl(
  storage: ObjectStoragePort | null,
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (!storage) {
    return `/${trimmed}`;
  }
  const key = storage.extractKey(trimmed) ?? trimmed.replace(/^\/+/, "");
  return storage.getPublicUrl(key);
}
