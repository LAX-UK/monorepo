import type { ImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";

/**
 * Seed images ship with a storefront (`/shop/...` with Shop, `/art/...` with lax.art). Staff
 * tools run on their own hosts and only resolve absolute URLs, like those of real uploads, so
 * the seed stores each path under the origin of the storefront that serves it.
 */
export type SeedAssetOrigins = {
  shop: string;
  art: string | undefined;
};

const trimTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

function originFor(path: string, origins: SeedAssetOrigins): string | undefined {
  if (path.startsWith("/art/")) return origins.art;
  if (path.startsWith("/shop/")) return origins.shop;
  return undefined;
}

export function absoluteSeedAssetUrl<T extends string | null | undefined>(
  value: T,
  origins: SeedAssetOrigins,
): T | string {
  if (!value?.startsWith("/")) return value;
  const origin = originFor(value, origins);
  return origin ? `${trimTrailingSlashes(origin)}${value}` : value;
}

export function withAbsoluteSeedAssetUrls(
  importArtwork: ImportArtworkHandler,
  origins: SeedAssetOrigins,
): ImportArtworkHandler {
  return (command) =>
    importArtwork({
      ...command,
      primaryImageUrl: absoluteSeedAssetUrl(command.primaryImageUrl, origins),
      ...(command.artistPortraitUrl !== undefined
        ? { artistPortraitUrl: absoluteSeedAssetUrl(command.artistPortraitUrl, origins) }
        : {}),
    });
}
