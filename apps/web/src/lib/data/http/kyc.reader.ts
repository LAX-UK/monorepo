import "server-only";

import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { kycStatusSummarySchema } from "@/lib/data/http/kyc.schema";
import { mapKycSessionStartError, normalizeKycReturnUrl } from "@/lib/kyc";
import { KycStatusUnavailableError } from "@/lib/kyc/kyc-status-unavailable-error";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { cache } from "react";
import { z } from "zod";

export type { KycStatusSummaryDto };

export const getServerKycStatusSummary = cache(
  async function getServerKycStatusSummary(): Promise<KycStatusSummaryDto | null> {
    try {
      const res = await authedServerFetch("/kyc/status");
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new KycStatusUnavailableError(res.status);
      const body = await readJsonBody(res);
      return readDataEnvelope(body, kycStatusSummarySchema, "GET /kyc/status");
    } catch (error) {
      if (error instanceof KycStatusUnavailableError) throw error;
      throw new KycStatusUnavailableError();
    }
  },
);

export type PostKycSessionResult = { ok: true; url: string } | { ok: false; error: string };

type PostKycSessionOptions = {
  entityId?: string;
};

const kycSessionResponseSchema = z.object({
  verificationUrl: z.string().nullable().optional(),
  hostedUrl: z.string().nullable().optional(),
});

/** Starts hosted KYC (`POST /kyc/session`). */
export async function postServerKycSession(
  returnUrl: string,
  options?: PostKycSessionOptions,
): Promise<PostKycSessionResult> {
  const absoluteReturnUrl = normalizeKycReturnUrl(returnUrl);
  const res = await authedServerFetch("/kyc/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.entityId ? { [X_LEGAL_ENTITY_ID_HEADER]: options.entityId } : {}),
    },
    body: JSON.stringify({ returnUrl: absoluteReturnUrl }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { verificationUrl?: string | null; hostedUrl?: string | null };
    error?: unknown;
  };
  if (!res.ok) {
    return { ok: false, error: mapKycSessionStartError(body.error, res.status) };
  }
  const parsed = kycSessionResponseSchema.safeParse(body.data);
  const url = parsed.success ? (parsed.data.verificationUrl ?? parsed.data.hostedUrl) : undefined;
  if (!url) {
    return { ok: false, error: "Verification link unavailable. Try again later." };
  }
  return { ok: true, url };
}
