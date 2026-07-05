"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import {
  parseStripeConnectActionError,
  parseStripeConnectActionErrorFromBody,
} from "@/lib/connect/parse-stripe-connect-action-error";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import {
  stripeConnectAccountSessionSchema,
  stripeConnectStatusSchema,
  stripeConnectUrlSchema,
} from "@/lib/data/http/stripe-connect.schema";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { getSiteUrl } from "@/lib/site-url";
import { revalidatePath } from "next/cache";

export type StripeConnectSessionSurface = "onboarding" | "management";

function entityHeaders(entityId?: string): HeadersInit {
  return entityId ? { [X_LEGAL_ENTITY_ID_HEADER]: entityId } : {};
}

export async function ensureStripeConnectAccountAction(
  entityId?: string,
): Promise<{ ok: boolean; error?: string }> {
  return instrumentServerAction("ensureStripeConnectAccountAction", async () => {
    const res = await authedServerFetch("/stripe-connect/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...entityHeaders(entityId),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: await parseStripeConnectActionError(res, "stripe_connect_failed"),
      };
    }
    revalidateConnectPaths(entityId);
    return { ok: true };
  });
}

export async function syncStripeConnectAction(entityId?: string): Promise<
  | {
      ok: true;
      ready: boolean;
      payoutsEnabled: boolean;
      requirementsDue: string[];
      requirementsErrors: import("@auction/types").StripeConnectRequirementError[];
      disabledReason: string | null;
    }
  | { ok: false; error: string }
> {
  return instrumentServerAction("syncStripeConnectAction", async () => {
    const res = await authedServerFetch("/stripe-connect/sync", {
      method: "POST",
      headers: entityHeaders(entityId),
    });
    const body = await readJsonBody(res);
    if (!res.ok) {
      return {
        ok: false,
        error: parseStripeConnectActionErrorFromBody(
          body as Record<string, unknown>,
          "stripe_sync_failed",
        ),
      };
    }
    const data = readDataEnvelope(body, stripeConnectStatusSchema, "POST /stripe-connect/sync");
    revalidateConnectPaths(entityId);
    return {
      ok: true,
      ready: Boolean(data.ready),
      payoutsEnabled: Boolean(data.payoutsEnabled),
      requirementsDue: data.requirementsCurrentlyDue ?? [],
      requirementsErrors: data.requirementsErrors ?? [],
      disabledReason: data.disabledReason ?? null,
    };
  });
}

export async function createStripeConnectAccountSessionAction(
  surface: StripeConnectSessionSurface,
  entityId?: string,
): Promise<{ ok: true; clientSecret: string } | { ok: false; error: string }> {
  return instrumentServerAction("createStripeConnectAccountSessionAction", async () => {
    const res = await authedServerFetch("/stripe-connect/account-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...entityHeaders(entityId),
      },
      body: JSON.stringify({ surface }),
    });
    const body = await readJsonBody(res);
    if (!res.ok) {
      return {
        ok: false,
        error: parseStripeConnectActionErrorFromBody(
          body as Record<string, unknown>,
          "account_session_failed",
        ),
      };
    }
    const { clientSecret } = readDataEnvelope(
      body,
      stripeConnectAccountSessionSchema,
      "POST /stripe-connect/account-session",
    );
    if (!clientSecret) {
      return { ok: false, error: "missing_client_secret" };
    }
    return { ok: true, clientSecret };
  });
}

export async function openStripeDashboardLinkAction(
  entityId?: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return instrumentServerAction("openStripeDashboardLinkAction", async () => {
    const res = await authedServerFetch("/stripe-connect/dashboard-link", {
      method: "POST",
      headers: entityHeaders(entityId),
    });
    const body = await readJsonBody(res);
    if (!res.ok) {
      return {
        ok: false,
        error: parseStripeConnectActionErrorFromBody(
          body as Record<string, unknown>,
          "dashboard_link_failed",
        ),
      };
    }
    const { url } = readDataEnvelope(
      body,
      stripeConnectUrlSchema,
      "POST /stripe-connect/dashboard-link",
    );
    if (!url) return { ok: false, error: "missing_dashboard_url" };
    return { ok: true, url };
  });
}

/** Fallback hosted onboarding link (admin ops + legacy). */
export async function createStripeConnectOnboardingLinkAction(
  returnPath: string,
  entityId?: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return instrumentServerAction("createStripeConnectOnboardingLinkAction", async () => {
    const site = getSiteUrl();
    const returnUrl = `${site}${returnPath.startsWith("/") ? returnPath : `/${returnPath}`}`;
    const res = await authedServerFetch("/stripe-connect/onboarding-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...entityHeaders(entityId),
      },
      body: JSON.stringify({ returnUrl, refreshUrl: returnUrl }),
    });
    const body = await readJsonBody(res);
    if (!res.ok) {
      return {
        ok: false,
        error: parseStripeConnectActionErrorFromBody(
          body as Record<string, unknown>,
          "stripe_onboarding_failed",
        ),
      };
    }
    const { url } = readDataEnvelope(
      body,
      stripeConnectUrlSchema,
      "POST /stripe-connect/onboarding-link",
    );
    if (!url) return { ok: false, error: "missing_onboarding_url" };
    revalidateConnectPaths(entityId);
    return { ok: true, url };
  });
}

function revalidateConnectPaths(entityId?: string) {
  revalidatePath("/dashboard/seller/connect");
  revalidatePath("/dashboard/seller/payouts");
  if (entityId) {
    revalidatePath(`/dashboard/organisations/${entityId}`);
    revalidatePath(`/dashboard/organisations/${entityId}/connect`);
    revalidatePath("/onboarding/organisation/step/connect");
  }
}
