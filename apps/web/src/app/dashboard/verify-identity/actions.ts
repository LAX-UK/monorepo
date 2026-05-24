"use server";

import { getServerDataContainer } from "@/lib/data/container.server";

export type StartKycVerificationResult = { ok: true; url: string } | { ok: false; error: string };

export async function startKycVerification(returnUrl: string): Promise<StartKycVerificationResult> {
  const c = await getServerDataContainer();
  return c.kyc.startSession(returnUrl);
}
