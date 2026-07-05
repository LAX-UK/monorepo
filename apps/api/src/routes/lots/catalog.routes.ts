import {
  type Lot,
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  archiveCountQuerySchema,
  archiveSummaryQuerySchema,
  listLotsQuerySchema,
  viewerCanSeeNonPublicCatalog,
} from "@auction/validators";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { lotsWithCheckoutPricing } from "../../lib/lots-with-checkout-pricing.js";
import { mapLotToStaffListRow, mapLotToSummary } from "../../lib/mappers.js";
import { buildConnectRequiredByLotId } from "../../lib/seller-connect-readiness.js";
import { zValidator } from "../../lib/z-validator.js";
import type { LotHono, LotReadRouteDeps } from "./_shared.js";

export function attachLotCatalogRoutes(r: LotHono, deps: LotReadRouteDeps): void {
  const { container, optionalAuth } = deps;

  r.get("/", optionalAuth, zValidator("query", listLotsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const userId = c.get("userId");
    const role = c.get("userRole");
    const staffRole = c.get("userStaffRole");
    const viewerRole = normalizeUserRoleOrClient(role);
    const staff = normalizeUserStaffRole(staffRole ?? undefined);

    if (query.needsPhotos === "1" && !canManageCatalogue(viewerRole, staff)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const buildPayload = async () => {
      const resolveImages = query.resolveImages !== "0";
      const { data } = await container.lotService.listLotsForPublicApi(
        {
          status: query.statuses ? undefined : query.status,
          statuses: query.statuses,
          categoryId: query.categoryId,
          categoryIds: query.categoryIds,
          sellerLegalEntityId: query.sellerId,
          winnerId: query.winnerId,
          saleId: query.saleId,
          artistId: query.artistId,
          endYear: query.endYear,
          search: query.q,
          endingWithinHours: query.endingWithinHours,
          sort: query.sort,
          limit: query.limit,
          offset: query.offset,
          ...(query.needsPhotos === "1" ? { needsPhotos: true } : {}),
          resolveImages,
        },
        role,
        staffRole,
      );
      const canSeeLifecycle =
        roleHasCapability(viewerRole, "catalogue.write", staff) ||
        roleHasCapability(viewerRole, "auction.manage", staff);
      let rows = data;
      if (canSeeLifecycle && data.length > 0) {
        const snapshots = await container.lotLifecycleQueryService.getSnapshotsForLots(
          data.map((l) => l.id),
        );
        rows = data.map((lotRow) => {
          const snap = snapshots.get(lotRow.id);
          if (!snap) return lotRow;
          return {
            ...lotRow,
            lifecycleSummary: {
              lastEventType: snap.lastEventType,
              lastEventAt: snap.lastEventAt.toISOString(),
              returnCount: snap.returnCount,
            },
          };
        });
      }
      if (roleHasCapability(viewerRole, "auction.manage", staff) && rows.length > 0) {
        const staffRows = rows as Lot[];
        const eligibilityByLot =
          await container.lotSoftDeleteService.getDeleteEligibilityBatch(staffRows);
        rows = staffRows.map((lotRow) => {
          if (lotRow.status !== "draft" && lotRow.status !== "scheduled") {
            return lotRow;
          }
          const deleteEligibility = eligibilityByLot.get(lotRow.id);
          return deleteEligibility ? { ...lotRow, deleteEligibility } : lotRow;
        });
      }

      if (canSeeLifecycle && rows.length > 0) {
        const staffRows = rows as Lot[];
        const connectEnforced = container.stripeConnectService.isConfigured();
        const connectByLot = await buildConnectRequiredByLotId(
          staffRows,
          container.legalEntityRepository,
          connectEnforced,
        );
        rows = staffRows.map((lotRow) => ({
          ...lotRow,
          connectRequired: connectByLot.get(lotRow.id) ?? false,
        }));
        return { data: (rows as Lot[]).map(mapLotToStaffListRow) };
      }

      const withPricing = await lotsWithCheckoutPricing(container, rows);
      return { data: withPricing.map(mapLotToSummary) };
    };

    const canUseCache = userId == null && query.needsPhotos !== "1";
    if (canUseCache) {
      const key = container.cachedCatalogueListService.buildKey("lots", query);
      const payload = await container.cachedCatalogueListService.getOrLoad(key, buildPayload);
      return c.json(payload);
    }

    return c.json(await buildPayload());
  });

  r.get("/archive/summary", zValidator("query", archiveSummaryQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const { total, count } = await container.lotService.archiveEndedSummary({
      endYear: q.endYear,
    });
    return c.json({
      data: { totalHammer: total, endedLotCount: count },
    });
  });

  r.get("/archive/count", zValidator("query", archiveCountQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const count = await container.lotService.countMatching({
      status: "ended",
      categoryId: q.categoryId,
      categoryIds: q.categoryIds,
      endYear: q.endYear,
    });
    return c.json({ count });
  });

  r.get("/count", optionalAuth, zValidator("query", listLotsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const viewerRole = (c.get("userRole") ?? "client") as UserRole;
    const viewerStaffRole = normalizeUserStaffRole(c.get("userStaffRole") as string | null);
    const canSeeNonPublic = viewerCanSeeNonPublicCatalog(viewerRole, viewerStaffRole);
    const count = await container.lotService.countMatching({
      ...(q.status ? { status: q.status } : {}),
      ...(q.statuses ? { statuses: q.statuses } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.categoryIds ? { categoryIds: q.categoryIds } : {}),
      ...(q.q ? { search: q.q } : {}),
      ...(q.endingWithinHours !== undefined ? { endingWithinHours: q.endingWithinHours } : {}),
      ...(q.endYear !== undefined ? { endYear: q.endYear } : {}),
      ...(canSeeNonPublic ? {} : { requirePublicParentSale: true }),
    });
    return c.json({ count });
  });
}
