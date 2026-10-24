import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  ArtCacheInvalidator,
  ArtCatalogueScope,
} from "../../../application/ports/art-cache-invalidator.js";
import type { ArtRefresh } from "../../../application/ports/artwork-catalogue-admin.js";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Signs a preview link; it reads editorial content but never changes what is public. */
const NON_PUBLISHING_ROUTES = new Set(["/admin/v1/editorial/preview-token"]);

/**
 * Notifies lax.art after every successful editorial write (publish, unpublish, edits,
 * placements, links). Running in `onResponse` guarantees the handler, and so the database
 * transaction, has already committed: a rolled-back write ends in an error status and never
 * notifies. A drafts-only edit also notifies; that is a harmless extra cache refresh and
 * avoids re-deriving "is this published" in the HTTP layer.
 *
 * Delivery failures are logged and dropped, because the response is already sent and
 * lax.art's 120 second expiry still converges.
 */
export function registerArtCacheInvalidation(
  app: FastifyInstance,
  invalidator: ArtCacheInvalidator,
) {
  app.addHook("onResponse", async (request, reply) => {
    if (READ_METHODS.has(request.method)) return;
    if (reply.statusCode < 200 || reply.statusCode >= 300) return;
    if (NON_PUBLISHING_ROUTES.has(request.routeOptions.url ?? "")) return;
    try {
      await invalidator.invalidateEditorial();
    } catch (error) {
      request.log.warn({ err: error }, "lax.art editorial cache invalidation failed");
    }
  });
}

/**
 * After a committed artwork or artist write, asks lax.art to refresh its catalogue when the change
 * altered what it serves, and returns the result without the internal flag. Not awaited: the
 * response never waits on lax.art, and a failure (after the invalidator's own retry) is logged
 * and dropped, because lax.art's cache expiry still converges.
 */
export function afterArtCatalogueWrite<T extends ArtRefresh>(
  request: FastifyRequest,
  invalidator: ArtCacheInvalidator,
  scope: ArtCatalogueScope,
  result: T,
): Omit<T, "refreshesArt"> {
  const { refreshesArt, ...response } = result;
  if (refreshesArt) {
    invalidator.invalidateCatalogue(scope).catch((error: unknown) => {
      request.log.warn({ err: error, scope }, "lax.art catalogue cache invalidation failed");
    });
  }
  return response;
}
