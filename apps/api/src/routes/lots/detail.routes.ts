import {
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  isPublicCatalogLot,
  lotIdParamSchema,
  viewerCanSeeNonPublicCatalog,
} from "@auction/validators";
import { listLotDocumentsPublic } from "../../lib/list-lot-documents-public.js";
import { computeLotCheckoutPricing } from "../../lib/lot-checkout-pricing.js";
import { maskLotForPublicView } from "../../lib/lot-public-view.js";
import { presentLotImages } from "../../lib/media-presenters.js";
import { zValidator } from "../../lib/z-validator.js";
import type { LotHono, LotReadRouteDeps } from "./_shared.js";

export function attachLotDetailRoutes(r: LotHono, deps: LotReadRouteDeps): void {
  const { container, optionalAuth } = deps;

  r.get("/:id/bids", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const result = await container.lotService.listBidsForPublicApi({
      lotId: id,
      viewerRole: (c.get("userRole") ?? "client") as UserRole,
      viewerStaffRole: normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined),
      viewerId: c.get("userId"),
      limitQuery: c.req.query("limit"),
    });
    if (result.kind === "not_found") {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: result.data });
  });

  r.get("/:id/watch-count", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const result = await container.lotService.countWatchersForPublicApi(id);
    if (result.kind === "not_found") {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: { count: result.count } });
  });

  r.get("/:id/documents", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const data = await listLotDocumentsPublic(
      container.db,
      container.objectStorage,
      container.mediaUrlResolver,
      id,
    );
    return c.json({ data });
  });

  r.get("/:id", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const role = c.get("userRole");
    const staffRole = c.get("userStaffRole");
    const lot = await container.lotService.getById(id);
    if (!lot) {
      return c.json({ error: "Not found" }, 404);
    }
    const presented = await presentLotImages(
      container.mediaUrlResolver,
      lot,
      container.mediaAssetEnricher,
    );
    const sale = lot.saleId ? await container.saleService.getById(lot.saleId) : null;
    const canPreview = viewerCanSeeNonPublicCatalog(role, staffRole);
    if (!canPreview && !isPublicCatalogLot(presented, sale)) {
      return c.json({ error: "Not found" }, 404);
    }
    const withPricing = {
      ...presented,
      checkoutPricing: computeLotCheckoutPricing(presented, sale),
    };
    const viewerRole = normalizeUserRoleOrClient(role);
    const staff = normalizeUserStaffRole(staffRole ?? undefined);
    const deleteEligibility = roleHasCapability(viewerRole, "auction.manage", staff)
      ? await container.lotSoftDeleteService.getDeleteEligibility(id)
      : null;
    return c.json({
      data: {
        ...maskLotForPublicView(withPricing, role, staffRole),
        ...(deleteEligibility ? { deleteEligibility } : {}),
      },
    });
  });
}
