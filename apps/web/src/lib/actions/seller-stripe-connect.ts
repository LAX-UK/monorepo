"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getSiteUrl } from "@/lib/site-url";
import { revalidatePath } from "next/cache";

export async function ensureStripeConnectAccountAction(): Promise<{ ok: boolean; error?: string }> {
  const res = await authedServerFetch("/stripe-connect/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country: "GB" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "stripe_connect_failed" };
  }
  revalidatePath("/dashboard/seller/connect");
  return { ok: true };
}

export async function startStripeConnectOnboardingAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const site = getSiteUrl();
  const returnUrl = `${site}/dashboard/seller/connect`;
  const res = await authedServerFetch("/stripe-connect/onboarding-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnUrl, refreshUrl: returnUrl }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { url?: string }; error?: string };
  if (!res.ok) {
    return { ok: false, error: body.error ?? "stripe_onboarding_failed" };
  }
  const url = body.data?.url;
  if (!url) return { ok: false, error: "missing_onboarding_url" };
  revalidatePath("/dashboard/seller/connect");
  return { ok: true, url };
}
