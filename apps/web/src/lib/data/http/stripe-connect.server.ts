import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { cache } from "react";

export type StripeConnectStatus = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  disabledReason: string | null;
  ready: boolean;
  syncDegraded?: boolean;
};

export type StripeConnectClientConfig = {
  publishableKey: string | null;
  connectEnforced: boolean;
};

export type StripeConnectLoadError = "unauthorized" | "not_connected" | "server_error";

export type StripeConnectStatusLoadResult =
  | { ok: true; data: StripeConnectStatus }
  | { ok: false; error: StripeConnectLoadError };

function entityHeaders(legalEntityId?: string): HeadersInit | undefined {
  return legalEntityId ? { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId } : undefined;
}

/** Publishable key + enforcement flag for embedded Connect.js bootstrap. */
export const getServerStripeConnectClientConfig = cache(
  async function getServerStripeConnectClientConfig(): Promise<StripeConnectClientConfig> {
    const res = await authedServerFetch("/stripe-connect/client-config");
    if (!res.ok) {
      return { publishableKey: null, connectEnforced: false };
    }
    const body = (await res.json()) as { data: StripeConnectClientConfig };
    return body.data;
  },
);

/** Stripe Connect onboarding status for the acting or explicit entity context. */
export async function getServerStripeConnectStatus(
  legalEntityId?: string,
): Promise<StripeConnectStatusLoadResult> {
  const headers = entityHeaders(legalEntityId);
  const res = await authedServerFetch("/stripe-connect/status", headers ? { headers } : undefined);
  if (!res.ok) {
    const error: StripeConnectLoadError =
      res.status === 401 ? "unauthorized" : res.status === 404 ? "not_connected" : "server_error";
    return { ok: false, error };
  }
  const body = (await res.json()) as { data: StripeConnectStatus };
  return { ok: true, data: body.data };
}

/** Live sync from Stripe before gating org onboarding step completion. */
export async function syncServerStripeConnectStatus(
  legalEntityId: string,
): Promise<StripeConnectStatusLoadResult> {
  const headers = entityHeaders(legalEntityId);
  const init: Parameters<typeof authedServerFetch>[1] = { method: "POST" };
  if (headers) init.headers = headers;
  const res = await authedServerFetch("/stripe-connect/sync", init);
  if (!res.ok) {
    const error: StripeConnectLoadError =
      res.status === 401 ? "unauthorized" : res.status === 404 ? "not_connected" : "server_error";
    return { ok: false, error };
  }
  const body = (await res.json()) as { data: StripeConnectStatus };
  return { ok: true, data: body.data };
}
