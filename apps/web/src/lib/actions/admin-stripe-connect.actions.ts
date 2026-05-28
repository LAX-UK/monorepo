"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getSiteUrl } from "@/lib/site-url";
import { normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";

export async function adminSyncStripeConnectAction(
  legalEntityId: string,
): Promise<{ ok: boolean; error?: string }> {
  return instrumentServerAction("adminSyncStripeConnectAction", async () => {
    const res = await authedServerFetch(
      `/admin/legal-entities/${encodeURIComponent(legalEntityId)}/stripe-connect/sync`,
      { method: "POST" },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: normalizeApiErrorMessage(body.error, "sync_failed") };
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
    const site = getSiteUrl();
    const returnPath =
      kind === "organisation"
        ? `/dashboard/organisations/${legalEntityId}/connect`
        : "/dashboard/seller/connect";
    const returnUrl = `${site}${returnPath}`;
    const res = await authedServerFetch(
      `/admin/legal-entities/${encodeURIComponent(legalEntityId)}/stripe-connect/onboarding-link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl, refreshUrl: returnUrl }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: { url?: string };
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: normalizeApiErrorMessage(body.error, "onboarding_link_failed") };
    }
    const url = body.data?.url;
    if (!url) return { ok: false, error: "missing_url" };
    return { ok: true, url };
  });
}
