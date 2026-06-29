import { type UserRole, normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import {
  adminLotBrowseQuerySchema,
  lotIdOnlyParamSchema,
  lotIdParamSchema,
  returnLotToInventoryBodySchema,
} from "@auction/validators";
import type { Container } from "../../container.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireAuctionManage,
  requireLotsAccess,
  requireSpecialistCatalogueOrAuctionManage,
} from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminLotsRoutes(platform: AdminHono, container: Container): void {
  /** GET /admin/lots/browse — attachable draft lots for sale setup picker. */
  platform.get(
    "/lots/browse",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("query", adminLotBrowseQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await container.admin.lots.listAttachable({
        limit: query.limit,
        offset: query.offset,
        state: query.state,
        ...(query.q ? { q: query.q } : {}),
        ...(query.sellerLegalEntityId ? { sellerLegalEntityId: query.sellerLegalEntityId } : {}),
        ...(query.categoryIds ? { categoryIds: query.categoryIds } : {}),
        ...(query.artistId ? { artistId: query.artistId } : {}),
        ...(query.excludeSaleId ? { excludeSaleId: query.excludeSaleId } : {}),
      });
      return c.json({ data: result.data, total: result.total });
    },
  );

  /** GET /admin/lots/:lotId/lifecycle — snapshot + recent events for journey strip. */
  platform.get(
    "/lots/:lotId/lifecycle",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("param", lotIdOnlyParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const { snapshot, events } = await container.admin.lots.getLifecycle(lotId);
      return c.json({
        data: {
          snapshot: snapshot
            ? {
                currentStatus: snapshot.currentStatus,
                lastEventType: snapshot.lastEventType,
                lastEventAt: snapshot.lastEventAt.toISOString(),
                lastSaleId: snapshot.lastSaleId,
                returnCount: snapshot.returnCount,
              }
            : null,
          events: events.map((ev) => ({
            eventType: ev.eventType,
            occurredAt: ev.occurredAt.toISOString(),
            saleTitle: ev.saleTitle ?? null,
          })),
        },
      });
    },
  );

  /** POST /admin/lots/:lotId/return-to-inventory */
  platform.post(
    "/lots/:lotId/return-to-inventory",
    requireAuctionManage,
    zValidator("param", lotIdOnlyParamSchema),
    zValidator("json", returnLotToInventoryBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = normalizeUserRoleOrClient(c.get("userRole")) as UserRole;
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.admin.lots.returnToInventory(
        userId,
        role,
        lotId,
        {
          reason: body.reason,
          ...(body.confirmVoided !== undefined ? { confirmVoided: body.confirmVoided } : {}),
          ...(body.notifyBidders !== undefined ? { notifyBidders: body.notifyBidders } : {}),
        },
        staff,
      );
      return result.match(
        (lot) => c.json({ data: lot }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  /** GET /admin/lots/artist-backfill-review — pending `lot_artist_backfill` tasks (SE-P23). */
  platform.get("/lots/artist-backfill-review", requireLotsAccess, async (c) => {
    const rows = await container.admin.dashboard.listPendingAdminReviewTasks("lot_artist_backfill");
    return c.json({ data: rows });
  });

  /** GET /admin/lots/withdrawal-requests — pending seller withdrawal tasks (B3). */
  platform.get("/lots/withdrawal-requests", requireLotsAccess, async (c) => {
    const rows =
      await container.admin.dashboard.listPendingAdminReviewTasks("lot_withdrawal_request");
    return c.json({ data: rows });
  });

  /** POST /admin/lots/:id/approve-withdrawal-request — cancel lot after seller request (B3). */
  platform.post(
    "/lots/:id/approve-withdrawal-request",
    requireLotsAccess,
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = normalizeUserRoleOrClient(c.get("userRole")) as UserRole;
      const { id } = c.req.valid("param");
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const out = await container.admin.lots.approveWithdrawalRequest(userId, role, id, staff);
      if (!out.ok) {
        return c.json(
          out.code !== undefined ? { error: out.error, code: out.code } : { error: out.error },
          asHttpStatus(out.status),
        );
      }
      return c.json({ data: out.data });
    },
  );
}
