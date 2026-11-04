import { redirectSaleroomError } from "@/lib/actions/admin/_shared/saleroom-redirect";
import { assertAdminCapabilityForRedirect } from "@/lib/auth/assert-admin-action-capability";
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";

export async function assertSaleroomAccess(saleId: string): Promise<void> {
  const denied = await assertAdminCapabilityForRedirect(SALEROOM_ACCESS);
  if (!denied.ok) await redirectSaleroomError(saleId, denied.message);
}
