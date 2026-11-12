"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { stepUpErrorCode } from "@/lib/auth/step-up/step-up-error-code";
import { getLotReofferPreview } from "@/lib/data/http/admin-reoffers.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { BUYER_DEFAULT_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { ServiceResult } from "@/lib/services/http/service-result";
import type { CapabilityRequirement } from "@auction/types";
import {
  recordSellerAnswerBodySchema,
  sendReofferBodySchema,
  withdrawReofferBodySchema,
} from "@auction/validators";
import type { ReofferPreview } from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

/** Every step changes the lot's page and the staff inbox, so both are refreshed. */
function refresh(lotId: string) {
  revalidatePath(`/admin/lots/${lotId}`);
  revalidatePath("/admin/lots");
  revalidatePath("/admin");
}

function failure(r: Extract<ServiceResult<unknown>, { ok: false }>): ActionResult<never> {
  return actionFailure(r.message, undefined, r.status, stepUpErrorCode(r) ?? r.code);
}

/** The parts every staff step shares: who may do it, a valid body, and the same failure shape. */
async function step<Body, Out>(input: {
  name: string;
  access: CapabilityRequirement;
  id: string;
  lotId: string;
  schema: z.ZodType<Body, z.ZodTypeDef, unknown>;
  body: unknown;
  call: (id: string, body: Body) => Promise<ServiceResult<Out>>;
}): Promise<ActionResult<void>> {
  return instrumentServerAction(input.name, async () => {
    const denied = await denyUnlessAdminCapability(input.access);
    if (denied) return denied;
    const id = input.id.trim();
    const lotId = input.lotId.trim();
    if (!id || !lotId) return actionFailure("Missing re-offer");
    const parsed = input.schema.safeParse(input.body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const r = await input.call(id, parsed.data);
    if (!r.ok) return failure(r);
    refresh(lotId);
    return actionSuccess();
  });
}

/** Starts the offer to the next bidder: the seller is asked first (or LAX-owned stock goes on). */
export async function adminStartReofferResultAction(
  lotId: string,
  buyerDefaultId?: string,
): Promise<ActionResult<{ status: "awaiting_seller" | "ready" }>> {
  return instrumentServerAction("adminStartReofferResultAction", async () => {
    const denied = await denyUnlessAdminCapability(BUYER_DEFAULT_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) return actionFailure("Missing lot");
    const { adminReoffers } = getWriteContainer();
    const r = await adminReoffers.start(id, buyerDefaultId);
    if (!r.ok) return failure(r);
    refresh(id);
    return actionSuccess({ status: r.data.status });
  });
}

/** Records the seller's answer given by phone, email or in person; needs sales permission. */
export async function adminRecordSellerAnswerResultAction(
  lotId: string,
  reofferId: string,
  body: z.input<typeof recordSellerAnswerBodySchema>,
): Promise<ActionResult<void>> {
  return step({
    name: "adminRecordSellerAnswerResultAction",
    access: SALES_ACCESS,
    id: reofferId,
    lotId,
    schema: recordSellerAnswerBodySchema,
    body,
    call: (id, parsed) => getWriteContainer().adminReoffers.recordSellerAnswer(id, parsed),
  });
}

export async function adminSendReofferResultAction(
  lotId: string,
  reofferId: string,
  body: z.input<typeof sendReofferBodySchema>,
): Promise<ActionResult<void>> {
  return step({
    name: "adminSendReofferResultAction",
    access: BUYER_DEFAULT_ACCESS,
    id: reofferId,
    lotId,
    schema: sendReofferBodySchema,
    body,
    call: (id, parsed) => getWriteContainer().adminReoffers.send(id, parsed),
  });
}

export async function adminWithdrawReofferResultAction(
  lotId: string,
  reofferId: string,
  body: z.input<typeof withdrawReofferBodySchema>,
): Promise<ActionResult<void>> {
  return step({
    name: "adminWithdrawReofferResultAction",
    access: BUYER_DEFAULT_ACCESS,
    id: reofferId,
    lotId,
    schema: withdrawReofferBodySchema,
    body,
    call: (id, parsed) => getWriteContainer().adminReoffers.withdraw(id, parsed),
  });
}

/** Who the lot would be offered to next, for the Buyer default dialog's second option. */
export async function adminLoadReofferPreviewAction(
  lotId: string,
): Promise<ActionResult<ReofferPreview>> {
  return instrumentServerAction("adminLoadReofferPreviewAction", async () => {
    const denied = await denyUnlessAdminCapability(BUYER_DEFAULT_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) return actionFailure("Missing lot");
    const preview = await getLotReofferPreview(id);
    return preview ? actionSuccess(preview) : actionFailure("We couldn't check who bid next.");
  });
}
