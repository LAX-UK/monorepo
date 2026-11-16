import {
  cancelStorageTermsBodySchema,
  collectionVenueParamSchema,
  extendLotStorageBodySchema,
  setStorageChargingBodySchema,
  storageLotParamSchema,
  storageTermsBodySchema,
  storageTermsParamSchema,
  waiveLotStorageBodySchema,
} from "@auction/validators";
import type { Context } from "hono";
import { actorFromContext } from "../../lib/admin-actor-context.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireCollectionStorage,
  requireCollectionStorageRead,
  requireOperationsFulfilment,
} from "../../middleware/require-capability.js";
import type { CollectionStorageResult } from "../../services/collection-storage/collection-storage.errors.js";
import type { AdminCollectionStorageRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

/**
 * A collection place's storage terms and its "Raise storage invoices" switch (Bid admin ›
 * Collections › Storage). Fulfilment and read-only staff may look; Finance and Administrators
 * change them, after a recent sign-in (the step-up gate lists these paths). Mounted beside the
 * finance routes, so Finance, who has no platform shell, reaches it. A refusal keeps its status and
 * code and names the field at fault.
 */
export function attachAdminCollectionStorageRoutes(
  app: AdminHono,
  container: AdminCollectionStorageRoutesContainer,
): void {
  const service = container.admin.collectionStorage;
  const actorOf = (c: Context) => ({ userId: actorFromContext(c as never).userId });

  function answer<T>(c: Context, result: CollectionStorageResult<T>) {
    c.header("Cache-Control", "no-store");
    if (result.isOk()) return c.json({ data: result.value });
    const { code, message, status, issues } = result.error;
    return c.json({ error: code, message, ...(issues ? { issues } : {}) }, asHttpStatus(status));
  }

  app.get(
    "/collections/:venueId/storage",
    requireCollectionStorageRead,
    zValidator("param", collectionVenueParamSchema),
    async (c) => answer(c, await service.get(c.req.valid("param").venueId)),
  );

  app.post(
    "/collections/:venueId/storage/terms",
    requireCollectionStorage,
    zValidator("param", collectionVenueParamSchema),
    zValidator("json", storageTermsBodySchema),
    async (c) =>
      answer(
        c,
        await service.schedule(actorOf(c), c.req.valid("param").venueId, c.req.valid("json")),
      ),
  );

  app.put(
    "/collections/:venueId/storage/terms/:termsId",
    requireCollectionStorage,
    zValidator("param", storageTermsParamSchema),
    zValidator("json", storageTermsBodySchema),
    async (c) => {
      const { venueId, termsId } = c.req.valid("param");
      return answer(c, await service.edit(actorOf(c), venueId, termsId, c.req.valid("json")));
    },
  );

  // A POST, not a DELETE: the cancelled version is kept, and the body carries the reason.
  app.post(
    "/collections/:venueId/storage/terms/:termsId/cancel",
    requireCollectionStorage,
    zValidator("param", storageTermsParamSchema),
    zValidator("json", cancelStorageTermsBodySchema),
    async (c) => {
      const { venueId, termsId } = c.req.valid("param");
      return answer(c, await service.cancel(actorOf(c), venueId, termsId, c.req.valid("json")));
    },
  );

  app.put(
    "/collections/:venueId/storage/charging",
    requireCollectionStorage,
    zValidator("param", collectionVenueParamSchema),
    zValidator("json", setStorageChargingBodySchema),
    async (c) =>
      answer(
        c,
        await service.setCharging(actorOf(c), c.req.valid("param").venueId, c.req.valid("json")),
      ),
  );

  const followUp = container.admin.collectionStorageFollowUp;

  // The Not collected tab: lots left past their collect-by day, longest over first, with what is
  // owed so far. Everyone who sees the tab reads it; Finance waives from it.
  app.get(
    "/collections/:venueId/storage/overdue",
    requireCollectionStorageRead,
    zValidator("param", collectionVenueParamSchema),
    async (c) => answer(c, await followUp.overdue(c.req.valid("param").venueId)),
  );

  // Fulfilment (and Administrators) give a lot more free storage, up to 30 days in all.
  app.post(
    "/collections/:venueId/storage/lots/:lotId/extension",
    requireOperationsFulfilment,
    zValidator("param", storageLotParamSchema),
    zValidator("json", extendLotStorageBodySchema),
    async (c) => {
      const { venueId, lotId } = c.req.valid("param");
      return answer(c, await followUp.extend(actorOf(c), venueId, lotId, c.req.valid("json")));
    },
  );

  // Finance (and Administrators) waive a lot's charges, after a recent sign-in: it gives up money.
  app.post(
    "/collections/:venueId/storage/lots/:lotId/waiver",
    requireCollectionStorage,
    zValidator("param", storageLotParamSchema),
    zValidator("json", waiveLotStorageBodySchema),
    async (c) => {
      const { venueId, lotId } = c.req.valid("param");
      return answer(c, await followUp.waive(actorOf(c), venueId, lotId, c.req.valid("json")));
    },
  );
}
