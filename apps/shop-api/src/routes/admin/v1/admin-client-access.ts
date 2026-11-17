import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type ClientListScope, clientListScope } from "@auction/shop-domain";
import type { FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import { type ShopAdminAuthContext, staffCan } from "../../../plugins/shop-admin-auth.js";

export async function requireClientPartyReadAccess(
  request: FastifyRequest,
  deps: Pick<AdminRoutesDeps, "staffReader">,
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

/**
 * Which clients' consignor details someone reads, as on a client's page (ZI-5): people who keep
 * consignor agreements read every consignor; everyone else reads consignors only among the clients
 * they can open, so a broker reads the clients assigned to them. `none` without
 * `consignor_agreement.read`.
 */
export function consignorClientScope(auth: ShopAdminAuthContext): ClientListScope {
  if (!staffCan(auth, "consignor_agreement.read")) return "none";
  if (staffCan(auth, "consignor_agreement.manage")) return "all";
  return clientListScope(auth.capabilities);
}
