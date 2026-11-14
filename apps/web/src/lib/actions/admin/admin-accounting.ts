"use server";

import { ACCOUNTING_PATH } from "@/lib/admin/finance/accounting-queue.vm";
import { normalizeFinanceApiError } from "@/lib/admin/finance/finance-action-errors";
import { idempotencyHeader } from "@/lib/admin/finance/idempotency-key";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import {
  accountingReleaseResultSchema,
  accountingTryAgainResultSchema,
} from "@/lib/data/http/admin-accounting.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { ACCOUNTING_QUEUE_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { AccountingReleaseResult, AccountingTryAgainResult } from "@auction/types";
import { adminAccountingDocumentIdParamSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

export type TryAgainAccountingInput = { documentId: string; idempotencyKey?: string };

/**
 * Sends a refused accounting document again: the same document under the same LAX reference.
 * The API checks the permission and the document's state, and records who asked.
 */
export async function tryAgainAccountingDocumentAction(
  input: TryAgainAccountingInput,
): Promise<ActionResult<AccountingTryAgainResult>> {
  return instrumentServerAction("tryAgainAccountingDocumentAction", async () => {
    const denied = await denyUnlessAdminCapability(ACCOUNTING_QUEUE_WRITE_ACCESS);
    if (denied) return denied;
    const parsed = adminAccountingDocumentIdParamSchema.safeParse({ id: input.documentId });
    if (!parsed.success) return actionFailure("That document could not be found.");
    const res = await authedServerFetch(
      `/admin/finance/accounting/${encodeURIComponent(parsed.data.id)}/try-again`,
      { method: "POST", headers: idempotencyHeader(input.idempotencyKey) },
    );
    if (res.ok) {
      revalidatePath(ACCOUNTING_PATH);
      return actionSuccess(
        readDataEnvelope(
          await readJsonBody(res),
          accountingTryAgainResultSchema,
          "POST /admin/finance/accounting/:id/try-again",
        ),
      );
    }
    const fallback = "The document was not sent again.";
    const message = (await normalizeFinanceApiError(res, fallback)) ?? fallback;
    return actionFailure(message.replace(/ \(\d{3}\)$/, ""), undefined, res.status);
  });
}

/**
 * Releases a parked accounting document once its reason is settled: the API checks it against the
 * stored rows (a delivery invoice is rebuilt with the accountant's booking), queues the same
 * document under the same LAX reference, and records who asked. If the reason is not settled it
 * says why and nothing changes.
 */
export async function releaseAccountingDocumentAction(
  input: TryAgainAccountingInput,
): Promise<ActionResult<AccountingReleaseResult>> {
  return instrumentServerAction("releaseAccountingDocumentAction", async () => {
    const denied = await denyUnlessAdminCapability(ACCOUNTING_QUEUE_WRITE_ACCESS);
    if (denied) return denied;
    const parsed = adminAccountingDocumentIdParamSchema.safeParse({ id: input.documentId });
    if (!parsed.success) return actionFailure("That document could not be found.");
    const res = await authedServerFetch(
      `/admin/finance/accounting/${encodeURIComponent(parsed.data.id)}/release`,
      { method: "POST", headers: idempotencyHeader(input.idempotencyKey) },
    );
    if (res.ok) {
      revalidatePath(ACCOUNTING_PATH);
      return actionSuccess(
        readDataEnvelope(
          await readJsonBody(res),
          accountingReleaseResultSchema,
          "POST /admin/finance/accounting/:id/release",
        ),
      );
    }
    const fallback = "The document was not released.";
    const message = (await normalizeFinanceApiError(res, fallback)) ?? fallback;
    return actionFailure(message.replace(/ \(\d{3}\)$/, ""), undefined, res.status);
  });
}
