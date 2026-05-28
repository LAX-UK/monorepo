"use server";

import {
  createStripeConnectOnboardingLinkAction,
  ensureStripeConnectAccountAction,
} from "@/lib/actions/stripe-connect.actions";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { postServerKycSession } from "@/lib/data/http/kyc.server";
import { normalizeKycReturnUrl } from "@/lib/kyc";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { OrganizationOnboardingProfileInput } from "@auction/validators";

function entityHeaders(entityId: string): HeadersInit {
  return { [X_LEGAL_ENTITY_ID_HEADER]: entityId };
}

export async function patchOrgOnboardingProfileAction(
  entityId: string,
  payload: OrganizationOnboardingProfileInput,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return instrumentServerAction("patchOrgOnboardingProfileAction", async () => {
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
  });
}

export async function postOrgOnboardingDocumentAction(
  entityId: string,
  payload: { kind: string; uploadObjectId: string; label?: string },
): Promise<{ ok: boolean; status: number; error?: string }> {
  return instrumentServerAction("postOrgOnboardingDocumentAction", async () => {
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
  });
}

export async function postOrgOnboardingStepCompleteAction(
  entityId: string,
  stepKey: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return instrumentServerAction("postOrgOnboardingStepCompleteAction", async () => {
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
  });
}

export async function postOrgSubmitForReviewAction(
  entityId: string,
): Promise<{ ok: boolean; status: number; error?: string; missingSteps?: string[] }> {
  return instrumentServerAction("postOrgSubmitForReviewAction", async () => {
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
  });
}

export async function stripeConnectEnsureOrgAction(
  entityId: string,
): Promise<{ ok: boolean; error?: string }> {
  return ensureStripeConnectAccountAction(entityId);
}

export async function stripeConnectOnboardingLinkOrgAction(
  entityId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const returnPath = `/onboarding/organisation/step/connect?entityId=${encodeURIComponent(entityId)}`;
  return createStripeConnectOnboardingLinkAction(returnPath, entityId);
}

export async function startKycForOrganisationOnboardingAction(
  entityId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return instrumentServerAction("startKycForOrganisationOnboardingAction", async () => {
    const returnUrl = normalizeKycReturnUrl(
      `/onboarding/organisation/step/identity?entityId=${encodeURIComponent(entityId)}&kyc=complete`,
    );
    return postServerKycSession(returnUrl, { entityId });
  });
}

/** Label for onboarding chrome when resuming an existing draft (`entityId` in the URL). */
export async function getOrganisationOnboardingDisplayNameAction(
  entityId: string,
): Promise<{ ok: true; displayName: string } | { ok: false }> {
  return instrumentServerAction("getOrganisationOnboardingDisplayNameAction", async () => {
    const res = await authedServerFetch(`/legal-entities/${entityId}`, {
      headers: entityHeaders(entityId),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json().catch(() => ({}))) as {
      data?: { displayName?: string };
    };
    const displayName = body.data?.displayName?.trim();
    if (!displayName) return { ok: false };
    return { ok: true, displayName };
  });
}
