"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { getSiteUrl } from "@/lib/site-url";
import type { OrganizationOnboardingProfileInput } from "@auction/validators";

function entityHeaders(entityId: string): HeadersInit {
  return { [X_LEGAL_ENTITY_ID_HEADER]: entityId };
}

export async function patchOrgOnboardingProfileAction(
  entityId: string,
  payload: OrganizationOnboardingProfileInput,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await authedServerFetch(`/organizations/${entityId}/onboarding/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...entityHeaders(entityId),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, status: res.status, error: body.error ?? "request_failed" };
  }
  return { ok: true, status: res.status };
}

export async function postOrgOnboardingDocumentAction(
  entityId: string,
  payload: { kind: string; uploadObjectId: string; label?: string },
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await authedServerFetch(`/organizations/${entityId}/onboarding/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...entityHeaders(entityId),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, status: res.status, error: body.error ?? "request_failed" };
  }
  return { ok: true, status: res.status };
}

export async function postOrgOnboardingStepCompleteAction(
  entityId: string,
  stepKey: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await authedServerFetch(
    `/organizations/${entityId}/onboarding/steps/${stepKey}/complete`,
    {
      method: "POST",
      headers: entityHeaders(entityId),
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, status: res.status, error: body.error ?? "request_failed" };
  }
  return { ok: true, status: res.status };
}

export async function postOrgSubmitForReviewAction(
  entityId: string,
): Promise<{ ok: boolean; status: number; error?: string; missingSteps?: string[] }> {
  const res = await authedServerFetch(`/organizations/${entityId}/onboarding/submit-for-review`, {
    method: "POST",
    headers: entityHeaders(entityId),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    missingSteps?: string[];
  };
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: body.error ?? "request_failed",
      ...(body.missingSteps ? { missingSteps: body.missingSteps } : {}),
    };
  }
  return { ok: true, status: res.status };
}

export async function stripeConnectEnsureOrgAction(
  entityId: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await authedServerFetch("/stripe-connect/account", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...entityHeaders(entityId),
    },
    body: JSON.stringify({ country: "GB" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "stripe_connect_failed" };
  }
  return { ok: true };
}

export async function stripeConnectOnboardingLinkOrgAction(
  entityId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const site = getSiteUrl();
  const returnUrl = `${site}/onboarding/organisation/step/connect?entityId=${encodeURIComponent(entityId)}`;
  const refreshUrl = returnUrl;
  const res = await authedServerFetch("/stripe-connect/onboarding-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...entityHeaders(entityId),
    },
    body: JSON.stringify({ returnUrl, refreshUrl }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { url?: string };
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: body.error ?? `stripe_onboarding_link_${res.status}` };
  }
  const url = body.data?.url;
  if (!url) return { ok: false, error: "missing_url" };
  return { ok: true, url };
}

export async function startKycForOrganisationOnboardingAction(
  entityId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const site = getSiteUrl();
  const returnUrl = `${site}/onboarding/organisation/step/identity?entityId=${encodeURIComponent(entityId)}&kyc=1`;
  const res = await authedServerFetch("/kyc/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...entityHeaders(entityId) },
    body: JSON.stringify({ returnUrl }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { hostedUrl?: string | null };
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: body.error ?? `kyc_session_${res.status}` };
  }
  const url = body.data?.hostedUrl;
  if (!url) return { ok: false, error: "Verification link unavailable." };
  return { ok: true, url };
}
