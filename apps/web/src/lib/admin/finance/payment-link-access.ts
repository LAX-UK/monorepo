import { canOpenAdminRoute } from "@/lib/navigation/admin-route-access";
import { LOTS_READ_ACCESS, USERS_DIRECTORY_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { StaffRoles, UserRole } from "@auction/types";

/** Which record pages a payment screen may link to for this person. */
export type PaymentLinkAccess = {
  canOpenLot: boolean;
  canOpenClient: boolean;
};

/**
 * Lot and client pages sit in the platform admin area behind their own capability, so a
 * finance-only person cannot open them. The payment screens show those names as plain text
 * instead of a link that would end on the no-access page.
 */
export function paymentLinkAccess(
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): PaymentLinkAccess {
  return {
    canOpenLot: canOpenAdminRoute(role, staffRoles, "/admin/lots", LOTS_READ_ACCESS),
    canOpenClient: canOpenAdminRoute(role, staffRoles, "/admin/clients", USERS_DIRECTORY_ACCESS),
  };
}
