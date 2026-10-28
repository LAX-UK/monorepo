/**
 * Catalogue images are stored as the API received them: absolute URLs for uploads and the media
 * CDN, root-relative paths for seed assets that ship inside a storefront (`/shop/...` in Shop,
 * `/art/...` in lax.art). A root-relative path only works on the host that serves it, so every
 * surface reads images through one resolver built for where it runs.
 */
export type CatalogueImageViewer = "shop" | "art" | "staff";

export type CatalogueImageOrigins = {
  shop?: string | undefined;
  art?: string | undefined;
};

type SeedOwner = keyof CatalogueImageOrigins;

const SEED_PREFIXES: Readonly<Record<SeedOwner, string>> = {
  shop: "/shop/",
  art: "/art/",
};

/**
 * Seed folders each viewer serves from its own `public` directory. Shop also carries copies of
 * the lax.art artist portraits for its artist directory, so those stay relative there. Staff
 * tools run on their own host and serve none.
 */
const SERVED_LOCALLY: Readonly<Record<CatalogueImageViewer, readonly SeedOwner[]>> = {
  shop: ["shop", "art"],
  art: ["art"],
  staff: [],
};

export type CatalogueImageResolver = (url: string | null | undefined) => string | null;

function seedOwnerOf(path: string): SeedOwner | undefined {
  return (Object.keys(SEED_PREFIXES) as SeedOwner[]).find((owner) =>
    path.startsWith(SEED_PREFIXES[owner]),
  );
}

export function createCatalogueImageResolver(
  viewer: CatalogueImageViewer,
  origins: CatalogueImageOrigins,
): CatalogueImageResolver {
  const servedLocally = SERVED_LOCALLY[viewer];
  return (url) => {
    const value = url?.trim();
    if (!value) return null;
    const owner = seedOwnerOf(value);
    if (!owner || servedLocally.includes(owner)) return value;
    const origin = origins[owner]?.replace(/\/+$/, "");
    return origin ? `${origin}${value}` : value;
  };
}
