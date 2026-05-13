import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

/** Mirrors API `KycStatusSummary` (dates as ISO strings over the wire). */
export type KycStatusSummaryDto = {
  status: "unverified" | "pending" | "approved" | "rejected";
  verifiedAt: string | null;
  latestSessionId: string | null;
  pendingExposure: { total: number; currency: string };
  thresholdAmount: number;
  thresholdCurrency: string;
  requiresKyc: boolean;
};

export async function getServerKycStatusSummary(): Promise<KycStatusSummaryDto | null> {
  const res = await authedServerFetch("/kyc/status");
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: KycStatusSummaryDto };
  return body.data ?? null;
}
