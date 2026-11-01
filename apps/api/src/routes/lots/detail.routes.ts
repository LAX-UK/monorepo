import type { StaffRoles, UserRole } from "@auction/types";
import { lotIdParamSchema } from "@auction/validators";
import { respondBiddingRouteOutcome } from "../../lib/bidding-route-response.js";
import { respondCatalogHttpJson } from "../../lib/catalog-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { LotHono, LotReadRouteDeps } from "./_shared.js";

function viewerFromContext(c: {
  get(key: "userId" | "userRole"): string | null | undefined;
  get(key: "userStaffRoles"): StaffRoles | undefined;
}) {
  return {
    userId: c.get("userId"),
    role: c.get("userRole"),
    staffRoles: c.get("userStaffRoles"),
  };
}

export function attachLotDetailRoutes(r: LotHono, deps: LotReadRouteDeps): void {
  const { container, optionalAuth } = deps;
  const lotReadHttp = container.catalogRoutes.lotReadHttp;

  r.get("/:id/bids", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const result = await container.bidding.lotBidHistoryHttp.listForLot({
      lotId: id,
      viewerRole: (c.get("userRole") ?? "client") as UserRole,
      viewerStaffRoles: c.get("userStaffRoles"),
      viewerId: c.get("userId"),
      limitQuery: c.req.query("limit"),
    });
    if (result.kind === "not_found") {
      return c.json({ error: "Not found" }, 404);
    }
    if (result.kind === "err") {
      return respondBiddingRouteOutcome(c, result);
    }
    return c.json({ data: result.data });
  });

  // Anyone may read this: it names no bidder, paddle or account, only what the room could see.
  r.get("/:id/bid-history", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const result = await container.bidding.lotBidHistoryHttp.listPublicForLot({
      lotId: id,
      viewerId: c.get("userId"),
      limitQuery: c.req.query("limit"),
    });
    if (result.kind === "not_found") {
      return c.json({ error: "Not found" }, 404);
    }
    return respondBiddingRouteOutcome(c, result);
  });

  r.get("/:id/watch-count", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const response = await lotReadHttp.getWatchCount({ lotId: id });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/:id/documents", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const response = await lotReadHttp.listLotDocuments({ lotId: id });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/:id", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const response = await lotReadHttp.getLotDetail({ lotId: id, viewer: viewerFromContext(c) });
    return respondCatalogHttpJson(c, response);
  });
}
