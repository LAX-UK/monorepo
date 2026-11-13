"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { stepUpRequiredFailure } from "@/lib/auth/step-up/step-up-failure";
import { heldReasonSchema } from "@/lib/data/http/admin-seller-proceeds.shared";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { SELLER_AGREEMENT_RECORD_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { SignedAgreementErrors } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RecordedSale } from "./record-agreement.vm";

export type RecordAgreementInput = {
  lotId: string;
  commissionPercent: string;
  signedOn: string;
  uploadObjectId: string | null;
  reason: string;
  replace: boolean;
};

const lotIdSchema = z.string().uuid();

/** What the API says recording did to the sale; anything unreadable is treated as unknown. */
const recordedSaleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("released") }),
  z.object({ kind: z.literal("still_held"), reason: heldReasonSchema }),
  z.object({ kind: z.literal("already_paid") }),
  z.object({ kind: z.literal("already_priced") }),
  z.object({ kind: z.literal("no_sale") }),
]);

type Refusal = { error?: unknown; code?: unknown; fields?: SignedAgreementErrors };

/**
 * Records a seller's signed agreement for a held sale through the API, which checks the
 * permission, the fields, the PDF and writes the audit entry. Field errors come back for the form.
 */
export async function recordSignedAgreementAction(
  input: RecordAgreementInput,
): Promise<ActionResult<{ sellerNetPence: number | null; sale: RecordedSale | null }>> {
  return instrumentServerAction("recordSignedAgreementAction", async () => {
    const denied = await denyUnlessAdminCapability(SELLER_AGREEMENT_RECORD_ACCESS);
    if (denied) return denied;
    const lotId = lotIdSchema.safeParse(input.lotId);
    if (!lotId.success) return actionFailure("This lot could not be found.", undefined, 404);

    const res = await authedServerFetch(
      `/admin/seller-proceeds/lots/${encodeURIComponent(lotId.data)}/signed-agreement`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionPercent: input.commissionPercent,
          signedOn: input.signedOn,
          uploadObjectId: input.uploadObjectId,
          reason: input.reason,
          replace: input.replace,
        }),
      },
    );
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        data?: { sellerNetPence?: number | null; sale?: unknown };
      };
      const sale = recordedSaleSchema.safeParse(body.data?.sale);
      revalidatePath(`/admin/lots/${lotId.data}`);
      revalidatePath("/admin/payouts");
      revalidatePath("/admin/payouts/settlement");
      return actionSuccess({
        sellerNetPence: body.data?.sellerNetPence ?? null,
        sale: sale.success ? sale.data : null,
      });
    }
    if (await isStaffStepUpResponse(res)) return stepUpRequiredFailure();
    const body = (await res.json().catch(() => ({}))) as Refusal;
    const message =
      typeof body.error === "string" ? body.error : "The agreement could not be recorded.";
    const fields = body.fields
      ? Object.fromEntries(
          Object.entries(body.fields).map(([field, text]) => [field, text ? [text] : undefined]),
        )
      : {};
    return actionFailure(
      message,
      Object.keys(fields).length > 0 ? fields : undefined,
      res.status,
      typeof body.code === "string" ? body.code : undefined,
    );
  });
}

/** Marks an ATG sale as settled with its seller outside LAX; the reason goes to the audit log. */
export async function markSettledOutsideAction(input: {
  lotId: string;
  reason: string;
}): Promise<ActionResult<void>> {
  return instrumentServerAction("markSettledOutsideAction", async () => {
    const denied = await denyUnlessAdminCapability(SELLER_AGREEMENT_RECORD_ACCESS);
    if (denied) return denied;
    const lotId = lotIdSchema.safeParse(input.lotId);
    if (!lotId.success) return actionFailure("This lot could not be found.", undefined, 404);
    const res = await authedServerFetch(
      `/admin/seller-proceeds/lots/${encodeURIComponent(lotId.data)}/settled-outside`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: input.reason }),
      },
    );
    if (res.ok) {
      revalidatePath(`/admin/lots/${lotId.data}`);
      return actionSuccess(undefined);
    }
    if (await isStaffStepUpResponse(res)) return stepUpRequiredFailure();
    const body = (await res.json().catch(() => ({}))) as Refusal;
    return actionFailure(
      typeof body.error === "string" ? body.error : "The sale could not be marked as settled.",
      undefined,
      res.status,
    );
  });
}
