import type { ProjectorRunContext } from "./lib/projector.types.js";

export const SHOP_IDENTITY_PROJECTION_PROJECTOR = "shop_identity_projection";

const SHOP_IDENTITY_EVENT_TYPES = [
  "user.registered",
  "user.profile_updated",
  "user.identity_disabled",
  "user.identity_enabled",
  "user.identity_merged",
] as const;

export async function processShopIdentityProjection(ctx: ProjectorRunContext): Promise<void> {
  const service = ctx.shopIdentityProjection;
  if (!service) return;

  await ctx.projectorStateRepo.ensureCursor(SHOP_IDENTITY_PROJECTION_PROJECTOR);
  const cursor = await ctx.projectorStateRepo.getCursor(SHOP_IDENTITY_PROJECTION_PROJECTOR);
  const rows = await ctx.domainEventReader.listAfterCursor(cursor, {
    eventTypes: [...SHOP_IDENTITY_EVENT_TYPES],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      await service.apply(row.eventType, row.payload);
      maxId = row.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.log.error({ err, eventId: row.id }, "shop_identity_projection_failed");
      await ctx.projectorStateRepo.recordError(SHOP_IDENTITY_PROJECTION_PROJECTOR, message);
      return;
    }
  }

  if (maxId > cursor) {
    await ctx.projectorStateRepo.advanceCursor(SHOP_IDENTITY_PROJECTION_PROJECTOR, maxId);
  }
}
