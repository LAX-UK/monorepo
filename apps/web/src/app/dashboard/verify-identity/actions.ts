"use server";

import { postServerKycSession } from "@/lib/data/http/kyc.server";
import { getSiteUrl } from "@/lib/site-url";

export type StartKycVerificationResult = { ok: true; url: string } | { ok: false; error: string };

export async function startKycVerification(): Promise<StartKycVerificationResult> {
  const returnUrl = `${getSiteUrl()}/dashboard?kyc=complete`;
  return postServerKycSession(returnUrl);
}
