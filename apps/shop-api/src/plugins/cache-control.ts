import type { FastifyInstance } from "fastify";

const PUBLIC_CATALOGUE_CACHE =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400";

const PUBLIC_CATALOGUE_ROOTS = ["/v1/artworks", "/v1/categories", "/v1/artists"] as const;

/** Public CDN cache only for catalogue list or single-slug detail — not nested sub-resources (e.g. interest). */
export function isPublicCatalogueGetPath(pathname: string): boolean {
  for (const root of PUBLIC_CATALOGUE_ROOTS) {
    if (pathname === root) {
      return true;
    }
    if (pathname.startsWith(`${root}/`)) {
      const rest = pathname.slice(root.length + 1);
      if (!rest || rest.includes("/")) {
        return false;
      }
      return true;
    }
  }
  return false;
}

export function registerPublicCatalogueCaching(app: FastifyInstance): void {
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "GET") {
      reply.header("Cache-Control", "no-store");
      return payload;
    }
    const path = request.url.split("?")[0] ?? request.url;
    if (!isPublicCatalogueGetPath(path) || reply.statusCode >= 400) {
      reply.header("Cache-Control", "no-store");
      return payload;
    }
    reply.header("Cache-Control", PUBLIC_CATALOGUE_CACHE);
    reply.header("Vary", "Accept-Encoding");
    return payload;
  });
}
