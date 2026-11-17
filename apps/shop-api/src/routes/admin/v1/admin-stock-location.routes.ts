import { moveArtworksRequestSchema } from "@auction/artwork-register-contracts";
import {
  AdminArtworkLocationMoveBodySchema,
  AdminArtworkLocationMoveResultSchema,
  AdminArtworkLocationParamsSchema,
  AdminArtworkLocationSchema,
  AdminStockLocationConflictSchema,
  type AdminStockLocationCreateBody,
  AdminStockLocationCreateBodySchema,
  type AdminStockLocationListQuery,
  AdminStockLocationListQuerySchema,
  AdminStockLocationListSchema,
  AdminStockLocationParamsSchema,
  type AdminStockLocationStatusBody,
  AdminStockLocationStatusBodySchema,
  type AdminStockLocationUpdateBody,
  AdminStockLocationUpdateBodySchema,
  AdminStockLocationValidationSchema,
  AdminStockLocationWriteResultSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const tags = ["shop-admin"];

/**
 * The app's default body limit (1 KB) holds about 20 artwork ids. A move takes up to
 * `MOVE_BATCH_MAX` (repeats allowed, counted once) and a 500-character note, which UTF-8 can make
 * four times as many bytes.
 */
const MOVE_BODY_LIMIT = 16_384;
/** An 80-character name and a 200-character note, at up to four bytes a character. */
const LIST_BODY_LIMIT = 4_096;

const READ_ERRORS = { 403: ShopApiErrorBodySchema, 404: ShopApiErrorBodySchema } as const;
/** A 400 from the service names each field at fault (`issues`). */
const WRITE_ERRORS = {
  400: AdminStockLocationValidationSchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
} as const;
/** List writes: a stale version's 409 also says the version, so the page can offer to reload. */
const LIST_WRITE_ERRORS = { ...WRITE_ERRORS, 409: AdminStockLocationConflictSchema } as const;

/**
 * Stock location in LAX Admin (docs/design/stock-location.md).
 *
 * - Reading the list, and where an artwork is and has been: `artwork_location.read`. It comes with
 *   the From Zoho register and with moving.
 * - Moving one artwork or a selection: `artwork_location.move`, held by Catalogue editors and
 *   Administrators only (owner decision, 17 Nov 2026). Every other role gets a 403 here.
 * - Keeping the list (add, rename, retire, restore): `artwork_location.manage`, Administrator only,
 *   with a recent sign-in (`SHOP_ADMIN_STEP_UP_PATHS` lists `/admin/v1/artwork-locations`).
 *
 * Every write takes an `Idempotency-Key`, and writes its LAX Admin audit row in the same
 * transaction as the change. Nothing here writes to Zoho.
 */
export async function registerAdminStockLocationRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "stockLocations" | "stepUpMaxAuthAgeSeconds">,
) {
  /** Who is writing, and the key that makes a retry safe. */
  const actorOf = (request: FastifyRequest) => ({
    actorSubjectId: requireShopAdminSubject(request),
    idempotencyKey: requireIdempotencyKey(request),
  });

  app.get(
    "/artwork-locations",
    {
      schema: {
        tags,
        querystring: AdminStockLocationListQuerySchema,
        response: { 200: AdminStockLocationListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_location.read");
      const query = request.query as AdminStockLocationListQuery;
      return deps.stockLocations.listLocations({ includeRetired: query.includeRetired === true });
    },
  );

  app.post(
    "/artwork-locations",
    {
      bodyLimit: LIST_BODY_LIMIT,
      schema: {
        tags,
        body: AdminStockLocationCreateBodySchema,
        response: { 200: AdminStockLocationWriteResultSchema, ...LIST_WRITE_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_location.manage");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const actor = actorOf(request);
      const body = request.body as AdminStockLocationCreateBody;
      return deps.stockLocations.addLocation({ ...actor, name: body.name, note: body.note });
    },
  );

  app.patch(
    "/artwork-locations/:locationId",
    {
      bodyLimit: LIST_BODY_LIMIT,
      schema: {
        tags,
        params: AdminStockLocationParamsSchema,
        body: AdminStockLocationUpdateBodySchema,
        response: { 200: AdminStockLocationWriteResultSchema, ...LIST_WRITE_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_location.manage");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const actor = actorOf(request);
      const { locationId } = request.params as { locationId: string };
      const body = request.body as AdminStockLocationUpdateBody;
      return deps.stockLocations.updateLocation({
        ...actor,
        locationId,
        expectedVersion: body.expectedVersion,
        name: body.name,
        note: body.note,
      });
    },
  );

  app.post(
    "/artwork-locations/:locationId/retire",
    {
      schema: {
        tags,
        params: AdminStockLocationParamsSchema,
        body: AdminStockLocationStatusBodySchema,
        response: { 200: AdminStockLocationWriteResultSchema, ...LIST_WRITE_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_location.manage");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const actor = actorOf(request);
      const { locationId } = request.params as { locationId: string };
      const { expectedVersion } = request.body as AdminStockLocationStatusBody;
      return deps.stockLocations.retireLocation({ ...actor, locationId, expectedVersion });
    },
  );

  app.post(
    "/artwork-locations/:locationId/restore",
    {
      schema: {
        tags,
        params: AdminStockLocationParamsSchema,
        body: AdminStockLocationStatusBodySchema,
        response: { 200: AdminStockLocationWriteResultSchema, ...LIST_WRITE_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_location.manage");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const actor = actorOf(request);
      const { locationId } = request.params as { locationId: string };
      const { expectedVersion } = request.body as AdminStockLocationStatusBody;
      return deps.stockLocations.restoreLocation({ ...actor, locationId, expectedVersion });
    },
  );

  /**
   * "Move" on a record and "Move selected" alike. Kept outside `/artwork-locations` so moving
   * needs no recent sign-in. The schema describes the body; it is then parsed with the shared
   * `moveArtworksRequestSchema`, so the batch limit (distinct ids) is one rule for the route and
   * the store.
   */
  app.post(
    "/artwork-location-moves",
    {
      bodyLimit: MOVE_BODY_LIMIT,
      schema: {
        tags,
        body: AdminArtworkLocationMoveBodySchema,
        response: { 200: AdminArtworkLocationMoveResultSchema, ...WRITE_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_location.move");
      const actorSubjectId = requireShopAdminSubject(request);
      const idempotencyKey = requireIdempotencyKey(request);
      const parsed = moveArtworksRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          parsed.error.issues[0]?.message ?? "Invalid move",
          400,
        );
      }
      return deps.stockLocations.moveArtworks({
        actorSubjectId,
        idempotencyKey,
        request: parsed.data,
      });
    },
  );

  app.get(
    "/artwork-register/:registerId/location",
    {
      schema: {
        tags,
        params: AdminArtworkLocationParamsSchema,
        response: { 200: AdminArtworkLocationSchema, ...READ_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_location.read");
      const { registerId } = request.params as { registerId: string };
      const location = await deps.stockLocations.artworkLocation(registerId);
      if (!location) throw notFound("Artwork");
      return location;
    },
  );
}
