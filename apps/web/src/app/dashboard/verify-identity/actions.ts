"use server";

import { getServerDataContainer } from "@/lib/data/container.server";
import { getSiteUrl } from "@/lib/site-url";

export type StartKycVerificationResult = { ok: true; url: string } | { ok: false; error: string };

export async function startKycVerification(): Promise<StartKycVerificationResult> {
  const returnUrl = `${getSiteUrl()}/dashboard?kyc=complete`;
  const c = await getServerDataContainer();
  return c.kyc.startSession(returnUrl);
}
