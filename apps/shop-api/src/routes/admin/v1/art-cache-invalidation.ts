import type { FastifyInstance } from "fastify";
import type { ArtCacheInvalidator } from "../../../application/ports/art-cache-invalidator.js";

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
