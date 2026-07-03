"use server";

import { readApiActionErrorMeta, readApiError } from "@/lib/actions/_utils";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { SALEROOM_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { z } from "zod";

const saleroomCheckInCandidatesForm = z.object({
  saleId: z.string().uuid(),
  q: z.string().trim().min(2).max(200),
});

const saleroomCheckInForm = z.object({
  saleId: z.string().uuid(),
  userId: z.string().min(1).max(191),
  buyerLegalEntityId: z.string().uuid(),
  assignPaddle: z.boolean().default(true),
  bidLimit: z.coerce.number().finite().positive().max(1e12).optional(),
  paddleNumber: z.coerce.number().int().min(100).optional(),
});

export async function adminSaleroomCheckInCandidatesResultAction(
  input: unknown,
): Promise<ActionResult<{ items: AdminCheckInCandidate[] }>> {
  return instrumentServerAction("adminSaleroomCheckInCandidatesResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;

    const parsed = saleroomCheckInCandidatesForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const { saleId, q } = parsed.data;
    const res = await getWriteContainer().adminPaddle.checkInCandidates(saleId, q);
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, "Could not search clients"),
        undefined,
        res.status,
        res.code,
      );
    }
    return actionSuccess({ items: res.data.items });
  });
}

export async function adminSaleroomCheckInResultAction(input: unknown): Promise<
  ActionResult<{
    registrationId: string;
    paddleNumber: number | null;
    checkedInAt: string;
    bidLimit?: string;
  }>
> {
  return instrumentServerAction("adminSaleroomCheckInResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;

    const parsed = saleroomCheckInForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const res = await getWriteContainer().adminPaddle.checkIn(parsed.data);
    if (!res.ok) {
      const meta = readApiActionErrorMeta(res.body);
      return actionFailure(
        readApiError(res.body, "Check-in failed"),
        undefined,
        res.status,
        res.code,
        meta,
      );
    }
    return actionSuccess(res.data);
  });
}

const paddleRegistrationActionForm = z.object({
  saleId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

const paddleAssignForm = paddleRegistrationActionForm.extend({
  paddleNumber: z.coerce.number().int().min(100).optional(),
});

const paddlePlaceBidForm = z.object({
  saleId: z.string().uuid(),
  lotId: z.string().uuid(),
  paddleNumber: z.coerce.number().int().min(100),
  amount: z.coerce.number().finite().positive(),
  maxAutoBidAmount: z.coerce.number().finite().positive().optional(),
});

export async function adminAssignPaddleResultAction(
  input: unknown,
): Promise<ActionResult<{ paddleNumber: number }>> {
  return instrumentServerAction("adminAssignPaddleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const parsed = paddleAssignForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const { saleId, registrationId, paddleNumber } = parsed.data;
    const res = await getWriteContainer().adminPaddle.assignPaddle(
      saleId,
      registrationId,
      paddleNumber,
    );
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, "Paddle assignment failed"),
        undefined,
        res.status,
        res.code,
      );
    }
    return actionSuccess(res.data);
  });
}

export async function adminClearPaddleResultAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  return instrumentServerAction("adminClearPaddleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const parsed = paddleRegistrationActionForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const { saleId, registrationId } = parsed.data;
    const res = await getWriteContainer().adminPaddle.clearPaddle(saleId, registrationId);
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, "Clear paddle failed"),
        undefined,
        res.status,
        res.code,
      );
    }
    return actionSuccess(res.data);
  });
}

export async function adminPaddlePlaceBidResultAction(
  input: unknown,
): Promise<ActionResult<{ bidId: string }>> {
  return instrumentServerAction("adminPaddlePlaceBidResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const parsed = paddlePlaceBidForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const res = await getWriteContainer().adminPaddle.placeBid(parsed.data);
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, "Paddle bid failed"),
        undefined,
        res.status,
        res.code,
      );
    }
    return actionSuccess(res.data);
  });
}
