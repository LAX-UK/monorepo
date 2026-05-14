import "server-only";

import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { cache } from "react";

export type { KycStatusSummaryDto };

export const getServerKycStatusSummary = cache(
  async function getServerKycStatusSummary(): Promise<KycStatusSummaryDto | null> {
    const res = await authedServerFetch("/kyc/status");
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: KycStatusSummaryDto };
    return body.data ?? null;
  },
);

export type PostKycSessionResult = { ok: true; url: string } | { ok: false; error: string };

/** Starts hosted KYC (`POST /kyc/session`). */
export async function postServerKycSession(returnUrl: string): Promise<PostKycSessionResult> {
  const res = await authedServerFetch("/kyc/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnUrl }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { hostedUrl?: string | null };
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: body.error ?? `Could not start verification (${res.status})` };
  }
  const url = body.data?.hostedUrl;
  if (!url) {
    return { ok: false, error: "Verification link unavailable. Try again later." };
  }
  return { ok: true, url };
}
