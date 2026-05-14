import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type StripeConnectStatus = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  disabledReason: string | null;
  ready: boolean;
};

export type StripeConnectLoadError = "unauthorized" | "not_connected" | "server_error";

export type StripeConnectStatusLoadResult =
  | { ok: true; data: StripeConnectStatus }
  | { ok: false; error: StripeConnectLoadError };

/** Stripe Connect onboarding status for the acting context (`GET /stripe-connect/status`). */
export async function getServerStripeConnectStatus(): Promise<StripeConnectStatusLoadResult> {
  const res = await authedServerFetch("/stripe-connect/status");
  if (!res.ok) {
    const error: StripeConnectLoadError =
      res.status === 401 ? "unauthorized" : res.status === 404 ? "not_connected" : "server_error";
    return { ok: false, error };
  }
  const body = (await res.json()) as { data: StripeConnectStatus };
  return { ok: true, data: body.data };
}
