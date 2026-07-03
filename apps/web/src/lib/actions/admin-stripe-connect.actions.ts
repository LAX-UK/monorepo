"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { LEGAL_ENTITY_BROWSE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { getSiteUrl } from "@/lib/site-url";
import { normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";

export async function adminSyncStripeConnectAction(
  legalEntityId: string,
): Promise<{ ok: boolean; error?: string }> {
  return instrumentServerAction("adminSyncStripeConnectAction", async () => {
    const denied = await denyUnlessAdminCapability(LEGAL_ENTITY_BROWSE_ACCESS);
    if (denied && !denied.ok) {
      return { ok: false, error: denied.error };
    }
    const res = await getWriteContainer().adminStripeConnect.sync(legalEntityId);
    if (!res.ok) {
      const err =
        res.body && typeof res.body === "object" && "error" in res.body
          ? (res.body as { error?: unknown }).error
          : undefined;
      return { ok: false, error: normalizeApiErrorMessage(err, "sync_failed") };
    }
    revalidatePath(`/admin/legal-entities/${legalEntityId}`);
    return { ok: true };
  });
}

export async function adminCreateStripeConnectOnboardingLinkAction(
  legalEntityId: string,
  kind: "individual" | "organisation",
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return instrumentServerAction("adminCreateStripeConnectOnboardingLinkAction", async () => {
    const denied = await denyUnlessAdminCapability(LEGAL_ENTITY_BROWSE_ACCESS);
    if (denied && !denied.ok) {
      return { ok: false, error: denied.error };
    }
    const site = getSiteUrl();
    const returnPath =
      kind === "organisation"
        ? `/dashboard/organisations/${legalEntityId}/connect`
        : "/dashboard/seller/connect";
    const returnUrl = `${site}${returnPath}`;
    const res = await getWriteContainer().adminStripeConnect.createOnboardingLink(
      legalEntityId,
      returnUrl,
      returnUrl,
    );
    if (!res.ok) {
      const err =
        res.body && typeof res.body === "object" && "error" in res.body
          ? (res.body as { error?: unknown }).error
          : undefined;
      return { ok: false, error: normalizeApiErrorMessage(err, "onboarding_link_failed") };
    }
    return { ok: true, url: res.data.url };
  });
}
