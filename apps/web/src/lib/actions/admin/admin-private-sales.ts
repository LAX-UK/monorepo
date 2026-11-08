"use server";

import { ENQUIRIES_PATH } from "@/lib/admin/enquiries/enquiries.vm";
import { dealErrorMessage } from "@/lib/admin/private-sales/private-sale-errors";
import { DEALS_PATH, dealHref } from "@/lib/admin/private-sales/private-sales.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import {
  type DealRecord,
  convertedDealSchema,
  dealRecordSchema,
  dealRefusalSchema,
} from "@/lib/data/http/admin-private-sales.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import {
  PRIVATE_SALE_DEALS_FINANCE_ACCESS,
  PRIVATE_SALE_DEALS_MANAGE_ACCESS,
  PRIVATE_SALE_DEALS_READ_ACCESS,
  PRIVATE_SALE_DEALS_RELEASE_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";
import type { CapabilityRequirement } from "@auction/types";
import {
  type StaffDealAction,
  adminDealActionSchema,
  adminDealBuyerSchema,
  adminDealConvertSchema,
  adminDealTermsPatchSchema,
  enquiryRefParamSchema,
  privateSaleReferenceSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";

/** Who may even try each move; the Bid API decides again with the deal's stage in hand. */
const ACTION_ACCESS: Record<StaffDealAction, CapabilityRequirement> = {
  open_offer: PRIVATE_SALE_DEALS_MANAGE_ACCESS,
  agree: PRIVATE_SALE_DEALS_MANAGE_ACCESS,
  clear: PRIVATE_SALE_DEALS_MANAGE_ACCESS,
  cancel: PRIVATE_SALE_DEALS_MANAGE_ACCESS,
  issue_invoice: PRIVATE_SALE_DEALS_FINANCE_ACCESS,
  refund: PRIVATE_SALE_DEALS_FINANCE_ACCESS,
  record_bank_transfer: PRIVATE_SALE_DEALS_FINANCE_ACCESS,
  record_bank_refund: PRIVATE_SALE_DEALS_FINANCE_ACCESS,
  release: PRIVATE_SALE_DEALS_RELEASE_ACCESS,
};

const MONEY_ACTIONS: ReadonlySet<StaffDealAction> = new Set([
  "issue_invoice",
  "refund",
  "record_bank_transfer",
  "record_bank_refund",
]);

function idempotencyHeader(key: string | undefined): Record<string, string> {
  const supplied = key?.trim() ?? "";
  return {
    "Idempotency-Key":
      supplied.length >= 8 && supplied.length <= 128 ? supplied : crypto.randomUUID(),
  };
}

/** The API's refusal as an action result, keeping what a screen needs to explain it. */
async function refusal(res: Response): Promise<ActionResult<never>> {
  if (await isStaffStepUpResponse(res)) {
    return actionFailure("Recent sign-in required", undefined, 403, STAFF_STEP_UP_REQUIRED);
  }
  const body = dealRefusalSchema.safeParse(await res.json().catch(() => null));
  const code = body.success ? body.data.error : undefined;
  return actionFailure(
    dealErrorMessage(code, res.status),
    undefined,
    res.status,
    code,
    body.success
      ? {
          ...(body.data.fields ? { fields: body.data.fields } : {}),
          ...(body.data.blockers ? { blockers: body.data.blockers } : {}),
        }
      : undefined,
  );
}

async function record(res: Response, context: string): Promise<ActionResult<DealRecord>> {
  const deal = readDataEnvelope(await readJsonBody(res), dealRecordSchema, context);
  revalidatePath(DEALS_PATH);
  revalidatePath(dealHref(deal.reference));
  return actionSuccess(deal);
}

/** Changes terms against the version the person was looking at. */
export async function updateDealTermsAction(
  ref: string,
  input: unknown,
): Promise<ActionResult<DealRecord>> {
  return instrumentServerAction("updateDealTermsAction", async () => {
    const denied = await denyUnlessAdminCapability(PRIVATE_SALE_DEALS_READ_ACCESS);
    if (denied) return denied;
    const reference = privateSaleReferenceSchema.safeParse(ref);
    const patch = adminDealTermsPatchSchema.safeParse(input);
    if (!reference.success || !patch.success) {
      return actionFailure(patch.error?.issues[0]?.message ?? "Check the details.", undefined, 400);
    }
    const res = await authedServerFetch(
      `/admin/private-sales/${encodeURIComponent(reference.data)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch.data),
      },
    ).catch(() => null);
    if (!res) return actionFailure(dealErrorMessage(undefined, undefined), undefined, 503);
    return res.ok ? record(res, "PATCH /admin/private-sales/:ref") : refusal(res);
  });
}

/** Names the person who acts for the buyer. */
export async function nameDealBuyerAction(
  ref: string,
  input: unknown,
): Promise<ActionResult<DealRecord>> {
  return instrumentServerAction("nameDealBuyerAction", async () => {
    const denied = await denyUnlessAdminCapability(PRIVATE_SALE_DEALS_MANAGE_ACCESS);
    if (denied) return denied;
    const reference = privateSaleReferenceSchema.safeParse(ref);
    const body = adminDealBuyerSchema.safeParse(input);
    if (!reference.success || !body.success) {
      return actionFailure(body.error?.issues[0]?.message ?? "Check the details.", undefined, 400);
    }
    const res = await authedServerFetch(
      `/admin/private-sales/${encodeURIComponent(reference.data)}/buyer`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.data),
      },
    ).catch(() => null);
    if (!res) return actionFailure(dealErrorMessage(undefined, undefined), undefined, 503);
    return res.ok ? record(res, "PUT /admin/private-sales/:ref/buyer") : refusal(res);
  });
}

/**
 * One move on a deal. Moves that take or return money carry an idempotency key, so a double
 * submit repeats one request, and need a recent sign-in.
 */
export async function dealMoveAction(
  ref: string,
  action: StaffDealAction,
  input: { version: number; reason?: string; amountMinor?: number; idempotencyKey?: string },
): Promise<ActionResult<DealRecord>> {
  return instrumentServerAction("dealMoveAction", async () => {
    const denied = await denyUnlessAdminCapability(
      ACTION_ACCESS[action] ?? PRIVATE_SALE_DEALS_FINANCE_ACCESS,
    );
    if (denied) return denied;
    const reference = privateSaleReferenceSchema.safeParse(ref);
    const body = adminDealActionSchema.safeParse({
      version: input.version,
      reason: input.reason || undefined,
      amountMinor: input.amountMinor || undefined,
    });
    if (!reference.success || !body.success) {
      return actionFailure(body.error?.issues[0]?.message ?? "Check the details.", undefined, 400);
    }
    const res = await authedServerFetch(
      `/admin/private-sales/${encodeURIComponent(reference.data)}/actions/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(MONEY_ACTIONS.has(action) ? idempotencyHeader(input.idempotencyKey) : {}),
        },
        body: JSON.stringify(body.data),
      },
    ).catch(() => null);
    if (!res) return actionFailure(dealErrorMessage(undefined, undefined), undefined, 503);
    return res.ok ? record(res, "POST /admin/private-sales/:ref/actions/:action") : refusal(res);
  });
}

/** Turns a private sale enquiry into a proposed deal and returns the deal's reference. */
export async function convertEnquiryAction(
  enquiryRef: string,
  input: unknown,
): Promise<ActionResult<{ reference: string }>> {
  return instrumentServerAction("convertEnquiryAction", async () => {
    const denied = await denyUnlessAdminCapability(PRIVATE_SALE_DEALS_MANAGE_ACCESS);
    if (denied) return denied;
    const param = enquiryRefParamSchema.safeParse({ ref: enquiryRef });
    const body = adminDealConvertSchema.safeParse(input);
    if (!param.success || !body.success) {
      return actionFailure(body.error?.issues[0]?.message ?? "Check the details.", undefined, 400);
    }
    const res = await authedServerFetch(
      `/admin/enquiries/${encodeURIComponent(param.data.ref)}/convert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.data),
      },
    ).catch(() => null);
    if (!res) return actionFailure(dealErrorMessage(undefined, undefined), undefined, 503);
    if (!res.ok) return refusal(res);
    const converted = readDataEnvelope(
      await readJsonBody(res),
      convertedDealSchema,
      "POST /admin/enquiries/:ref/convert",
    );
    revalidatePath(DEALS_PATH);
    revalidatePath(ENQUIRIES_PATH);
    return actionSuccess(converted);
  });
}
