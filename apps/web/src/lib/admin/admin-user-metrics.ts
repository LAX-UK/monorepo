import type { AdminPaymentRow } from "@/lib/data/http/admin.server";
import { getAdminSubmissionCountBySellers } from "@/lib/data/http/submissions.server";

export type AdminUserSummaryMetrics = {
  lifetimeSpend: number | null;
  lotsWon: number | null;
  submissionsCount: number | null;
  memberSinceIso: string;
};

type SummaryInput = {
  lifetimeSpend: number;
  lotsWon: number;
  submissionsCount: number;
  memberSinceIso: string;
};

export function buildClientSummaryMetrics(input: SummaryInput): AdminUserSummaryMetrics {
  return {
    lifetimeSpend: input.lifetimeSpend > 0 ? input.lifetimeSpend : null,
    lotsWon: input.lotsWon,
    submissionsCount: input.submissionsCount > 0 ? input.submissionsCount : null,
    memberSinceIso: input.memberSinceIso,
  };
}

export function sumCapturedPayments(payments: AdminPaymentRow[]): number {
  return payments
    .filter((p) => p.status === "captured")
    .reduce((acc, p) => acc + Number.parseFloat(p.amount || "0"), 0);
}

/** Sum submission totals across seller legal entities (single batched admin query). */
export async function sumSubmissionTotalsForSellers(sellerIds: readonly string[]): Promise<number> {
  return getAdminSubmissionCountBySellers(sellerIds);
}
