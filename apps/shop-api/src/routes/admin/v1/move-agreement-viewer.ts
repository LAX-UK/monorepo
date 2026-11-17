import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { AdminMoveAgreement } from "@auction/shop-contracts";
import type { FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import { requireClientPartyReadAccess } from "./admin-client-access.js";

/**
 * The move dialog's agreement line as this person may see it. The state, the outcome and the
 * lowest price are for everyone who can move the work. The consignor's name and the agreement's
 * dates and places follow the client page's rule: `consignor_agreement.manage`, or
 * `consignor_agreement.read` for a client this person can open (a broker, their own clients only).
 * "Add agreement" is offered with `consignor_agreement.manage`.
 */
export async function moveAgreementForViewer(
  request: FastifyRequest,
  deps: Pick<AdminRoutesDeps, "staffReader">,
  view: AdminMoveAgreement,
): Promise<AdminMoveAgreement> {
  const capabilities = request.shopAdminAuth?.capabilities;
  const canManage = capabilities?.has("consignor_agreement.manage") === true;
  const canRead =
    canManage ||
    (view.consignor !== null &&
      capabilities?.has("consignor_agreement.read") === true &&
      (await clientReadable(request, deps, view.consignor.partyId)));
  if (canRead) return { ...view, canAddAgreement: canManage };
  return { ...view, consignor: null, agreement: null, canAddAgreement: false };
}

async function clientReadable(
  request: FastifyRequest,
  deps: Pick<AdminRoutesDeps, "staffReader">,
  partyId: string,
): Promise<boolean> {
  try {
    await requireClientPartyReadAccess(request, deps, partyId);
    return true;
  } catch (error) {
    if (error instanceof ShopApiError && error.code === SHOP_API_ERROR_CODES.FORBIDDEN)
      return false;
    throw error;
  }
}
