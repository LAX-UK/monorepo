import {
  addCollectionExceptionBodySchema,
  collectionExceptionParamSchema,
  collectionVenueParamSchema,
  removeCollectionExceptionBodySchema,
  saveCollectionSettingsBodySchema,
} from "@auction/validators";
import type { Context } from "hono";
import { actorFromContext } from "../../lib/admin-actor-context.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireCollectionsRead,
  requireOperationsFulfilment,
} from "../../middleware/require-capability.js";
import type { CollectionSettingsResult } from "../../services/collection-settings/collection-settings.errors.js";
import type { AdminCollectionSettingsRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

/**
 * Staff running a place's collection hours, rules and closures. Reading is open to everyone who
 * may see the Collections page; every change is for the Fulfilment role and needs a recent
 * sign-in (the step-up gate lists these paths). A refusal keeps its status and code, and carries
 * the fields at fault or the bookings a change would affect.
 */
export function attachAdminCollectionSettingsRoutes(
  platform: AdminHono,
  container: AdminCollectionSettingsRoutesContainer,
): void {
  const service = container.admin.collectionSettings;
  const actorOf = (c: Context) => ({ userId: actorFromContext(c as never).userId });

  function answer<T>(c: Context, result: CollectionSettingsResult<T>) {
    c.header("Cache-Control", "no-store");
    if (result.isOk()) return c.json({ data: result.value });
    const { code, message, status, issues, affected } = result.error;
    return c.json(
      { error: code, message, ...(issues ? { issues } : {}), ...(affected ? { affected } : {}) },
      asHttpStatus(status),
    );
  }

  platform.get("/collections", requireCollectionsRead, async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ data: await service.venues() });
  });

  platform.get(
    "/collections/:venueId",
    requireCollectionsRead,
    zValidator("param", collectionVenueParamSchema),
    async (c) => answer(c, await service.get(c.req.valid("param").venueId)),
  );

  platform.put(
    "/collections/:venueId",
    requireOperationsFulfilment,
    zValidator("param", collectionVenueParamSchema),
    zValidator("json", saveCollectionSettingsBodySchema),
    async (c) =>
      answer(c, await service.save(actorOf(c), c.req.valid("param").venueId, c.req.valid("json"))),
  );

  platform.post(
    "/collections/:venueId/exceptions",
    requireOperationsFulfilment,
    zValidator("param", collectionVenueParamSchema),
    zValidator("json", addCollectionExceptionBodySchema),
    async (c) =>
      answer(
        c,
        await service.addException(actorOf(c), c.req.valid("param").venueId, c.req.valid("json")),
      ),
  );

  // A POST, not a DELETE: the body carries the choice about the visits it affects.
  platform.post(
    "/collections/:venueId/exceptions/:exceptionId/remove",
    requireOperationsFulfilment,
    zValidator("param", collectionExceptionParamSchema),
    zValidator("json", removeCollectionExceptionBodySchema),
    async (c) => {
      const { venueId, exceptionId } = c.req.valid("param");
      return answer(
        c,
        await service.removeException(actorOf(c), venueId, exceptionId, c.req.valid("json")),
      );
    },
  );
}
