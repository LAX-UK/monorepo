"use server";

import { normalizeFinanceApiError } from "@/lib/admin/finance/finance-action-errors";
import { idempotencyHeader } from "@/lib/admin/finance/idempotency-key";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { stepUpRequiredFailure } from "@/lib/auth/step-up/step-up-failure";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { DISPUTE_ALLOCATION_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { adminDisputeAllocationBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

export type AllocateDisputeInput = {
  caseId: string;
  expectedVersion: number;
  lines: { paymentId: string; amountPence: number }[];
  note: string;
  idempotencyKey?: string;
};

/**
 * Puts a dispute on the invoices it falls on. The API checks the shares, takes each seller's net
 * share from their payout, and keeps the reason on the audit event. A stale sign-in becomes the
 * step-up code so the dialog can ask for a fresh one.
 */
export async function allocateDisputeResultAction(
  input: AllocateDisputeInput,
): Promise<ActionResult<void>> {
  return instrumentServerAction("allocateDisputeResultAction", async () => {
    const denied = await denyUnlessAdminCapability(DISPUTE_ALLOCATION_WRITE_ACCESS);
    if (denied) return denied;
    const caseId = input.caseId.trim();
    if (!caseId) return actionFailure("Missing dispute");
    const parsed = adminDisputeAllocationBodySchema.safeParse({
      expectedVersion: input.expectedVersion,
      lines: input.lines,
      note: input.note,
    });
    if (!parsed.success) {
      return actionFailure("Check the shares and enter a reason of at least 10 characters.");
    }
    const res = await authedServerFetch(
      `/admin/finance/dispute-cases/${encodeURIComponent(caseId)}/allocation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idempotencyHeader(input.idempotencyKey) },
        body: JSON.stringify(parsed.data),
      },
    );
    if (res.ok) {
      revalidatePath("/admin/disputes");
      revalidatePath(`/admin/disputes/${caseId}`);
      return actionSuccess();
    }
    if (await isStaffStepUpResponse(res)) {
      return stepUpRequiredFailure();
    }
    const fallback = "The allocation did not go through.";
    const message = (await normalizeFinanceApiError(res, fallback)) ?? fallback;
    return actionFailure(message.replace(/ \(\d{3}\)$/, ""), undefined, res.status);
  });
}
