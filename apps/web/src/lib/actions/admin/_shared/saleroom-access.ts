import { assertAdminCapabilityForRedirect } from "@/lib/auth/assert-admin-action-capability";
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";
import { redirect } from "next/navigation";

export async function assertSaleroomAccess(saleId: string): Promise<void> {
  const denied = await assertAdminCapabilityForRedirect(SALEROOM_ACCESS);
  if (!denied.ok) {
    redirect(
      `/admin/saleroom/${encodeURIComponent(saleId)}?error=${encodeURIComponent(denied.message)}`,
    );
  }
}
