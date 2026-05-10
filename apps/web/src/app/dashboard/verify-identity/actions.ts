"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getSiteUrl } from "@/lib/site-url";

export type StartKycVerificationResult = { ok: true; url: string } | { ok: false; error: string };

export async function startKycVerification(): Promise<StartKycVerificationResult> {
  const returnUrl = `${getSiteUrl()}/dashboard?kyc=complete`;
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
