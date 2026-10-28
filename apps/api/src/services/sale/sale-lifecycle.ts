import type { Lot, Sale, StaffRoles } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";
import { SalePublishService } from "./sale-publish.service.js";
import type { SaleServiceDeps } from "./sale-types.js";

export async function publishSale(
  deps: SaleServiceDeps,
  userId: string,
  userRole: string,
  saleId: string,
  userStaffRoles?: StaffRoles | undefined,
): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>> {
  return new SalePublishService(deps).publish(userId, userRole, saleId, userStaffRoles);
}

/** Revert a scheduled sale (and its scheduled lots) back to draft. */
export async function unpublishSale(
  deps: SaleServiceDeps,
  userId: string,
  userRole: string,
  saleId: string,
  userStaffRoles?: StaffRoles | undefined,
): Promise<Result<Sale, LotError | AuthzError>> {
  return new SalePublishService(deps).unpublish(userId, userRole, saleId, userStaffRoles);
}

export async function cancelSale(
  deps: SaleServiceDeps,
  userId: string,
  userRole: string,
  saleId: string,
  userStaffRoles?: StaffRoles | undefined,
): Promise<Result<Sale, LotError | AuthzError>> {
  return new SalePublishService(deps).cancel(userId, userRole, saleId, userStaffRoles);
}
