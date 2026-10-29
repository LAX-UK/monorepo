import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { clientListScope } from "@auction/shop-domain";
import type { FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";

export async function requireClientPartyReadAccess(
  request: FastifyRequest,
  deps: AdminRoutesDeps,
  partyId: string,
): Promise<void> {
  const auth = request.shopAdminAuth;
  if (!auth) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
  }
  const scope = clientListScope(auth.capabilities);
  if (scope === "all") {
    return;
  }
  if (scope === "assigned") {
    const assigned = await deps.staffReader.brokerCanAccessClientParty(auth.subject, partyId);
    if (!assigned) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Insufficient capability", 403);
    }
    return;
  }
  throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Insufficient capability", 403);
}
