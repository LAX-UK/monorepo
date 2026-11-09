import {
  collectionDeskBookForClientBodySchema,
  collectionDeskBookingParamSchema,
  collectionDeskDayQuerySchema,
  collectionDeskHandOverBodySchema,
  collectionDeskListQuerySchema,
  collectionDeskNotCollectedBodySchema,
  collectionDeskRebookBodySchema,
  collectionDeskUndoBodySchema,
  collectionDeskVenueParamSchema,
} from "@auction/validators";
import type { Context } from "hono";
import { actorFromContext } from "../../lib/admin-actor-context.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireCollectionsRead,
  requireOperationsFulfilment,
} from "../../middleware/require-capability.js";
import type { CollectionDeskResult } from "../../services/collection-desk/collection-desk.errors.js";
import type { AdminCollectionDeskRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

/**
 * The collections desk: a day of visits, a hand-over with a photo ID check, missed visits, and
 * booking for a client. Reading is for everyone who may see Collections; every change is for the
 * Fulfilment role. Hand-over, its undo and marking a visit missed also need a recent sign-in (the
 * step-up gate lists them) and an Idempotency-Key, so a double tap hands a work over once. A
 * refusal keeps its status and code and names the lots at fault.
 */
export function attachAdminCollectionDeskRoutes(
  platform: AdminHono,
  container: AdminCollectionDeskRoutesContainer,
  guards: AdminStaffMutationGuards,
): void {
  const service = container.admin.collectionDesk;
  const staffOf = (c: Context) => ({ userId: actorFromContext(c as never).userId });

  function answer<T>(c: Context, result: CollectionDeskResult<T>, status: 200 | 201 = 200) {
    c.header("Cache-Control", "no-store");
    if (result.isOk()) return c.json({ data: result.value }, status);
    const { code, message, status: failed, lotId, lotIds, reason, issues } = result.error;
    return c.json(
      {
        error: code,
        message,
        ...(lotId ? { lotId } : {}),
        ...(lotIds ? { lotIds } : {}),
        ...(reason ? { reason } : {}),
        ...(issues ? { issues } : {}),
      },
      asHttpStatus(failed),
    );
  }

  platform.get(
    "/collection-desk/:venueId/day",
    requireCollectionsRead,
    zValidator("param", collectionDeskVenueParamSchema),
    zValidator("query", collectionDeskDayQuerySchema),
    async (c) =>
      answer(c, await service.day(c.req.valid("param").venueId, c.req.valid("query").date)),
  );

  platform.get(
    "/collection-desk/:venueId/bookings",
    requireCollectionsRead,
    zValidator("param", collectionDeskVenueParamSchema),
    zValidator("query", collectionDeskListQuerySchema),
    async (c) =>
      answer(c, await service.list(c.req.valid("param").venueId, c.req.valid("query").status)),
  );

  platform.post(
    "/collection-desk/bookings/:bookingId/hand-over",
    requireOperationsFulfilment,
    guards.idempotent("collection.hand-over"),
    zValidator("param", collectionDeskBookingParamSchema),
    zValidator("json", collectionDeskHandOverBodySchema),
    async (c) =>
      answer(
        c,
        await service.handOver(staffOf(c), c.req.valid("param").bookingId, c.req.valid("json")),
      ),
  );

  platform.post(
    "/collection-desk/bookings/:bookingId/undo-hand-over",
    requireOperationsFulfilment,
    guards.idempotent("collection.hand-over-undo"),
    zValidator("param", collectionDeskBookingParamSchema),
    zValidator("json", collectionDeskUndoBodySchema),
    async (c) => answer(c, await service.undoHandOver(staffOf(c), c.req.valid("param").bookingId)),
  );

  platform.post(
    "/collection-desk/bookings/:bookingId/not-collected",
    requireOperationsFulfilment,
    guards.idempotent("collection.not-collected"),
    zValidator("param", collectionDeskBookingParamSchema),
    zValidator("json", collectionDeskNotCollectedBodySchema),
    async (c) =>
      answer(c, await service.markNotCollected(staffOf(c), c.req.valid("param").bookingId)),
  );

  platform.post(
    "/collection-desk/bookings/:bookingId/rebook",
    requireOperationsFulfilment,
    zValidator("param", collectionDeskBookingParamSchema),
    zValidator("json", collectionDeskRebookBodySchema),
    async (c) =>
      answer(
        c,
        await service.rebook(staffOf(c), c.req.valid("param").bookingId, c.req.valid("json")),
      ),
  );

  platform.post(
    "/collection-desk/bookings",
    requireOperationsFulfilment,
    zValidator("json", collectionDeskBookForClientBodySchema),
    async (c) => {
      const result = await service.bookForClient(staffOf(c), c.req.valid("json"));
      if (result.isErr()) return answer(c, result);
      const { booking, replayed } = result.value;
      if (replayed) c.header("Idempotent-Replayed", "true");
      return answer(
        c,
        result.map(() => booking),
        replayed ? 200 : 201,
      );
    },
  );
}
