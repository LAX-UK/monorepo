"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { getServerDataContainer } from "@/lib/data/container.server";

export type StartKycVerificationResult = { ok: true; url: string } | { ok: false; error: string };

export async function startKycVerification(returnUrl: string): Promise<StartKycVerificationResult> {
  return instrumentServerAction("startKycVerification", async () => {
    const c = await getServerDataContainer();
    return c.kyc.startSession(returnUrl);
  });
}
