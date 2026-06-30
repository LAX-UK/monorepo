"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { parseAdminCheckInCandidate } from "@/lib/data/http/admin.server";
import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
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
    const res = await authedServerFetch(
      `/admin/sales/${encodeURIComponent(saleId)}/registrations/check-in-candidates?${new URLSearchParams({ q }).toString()}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return actionFailure(payload.error ?? "Could not search clients");
    }

    const json = (await res.json()) as { data?: { items?: unknown[] } };
    const items = (json.data?.items ?? []).map((row) => parseAdminCheckInCandidate(row));
    return actionSuccess({ items });
  });
}

export async function adminSaleroomCheckInResultAction(input: unknown): Promise<
  ActionResult<{
    registrationId: string;
    paddleNumber: number;
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

    const body = parsed.data;
    const res = await authedServerFetch(
      `/admin/sales/${encodeURIComponent(body.saleId)}/registrations/check-in`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: body.userId,
          buyerLegalEntityId: body.buyerLegalEntityId,
          ...(body.bidLimit != null ? { bidLimit: body.bidLimit } : {}),
          ...(body.paddleNumber != null ? { paddleNumber: body.paddleNumber } : {}),
        }),
      },
    );

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      return actionFailure(payload.error ?? "Check-in failed", undefined, res.status, payload.code);
    }

    const json = (await res.json()) as {
      data?: {
        registrationId?: string;
        paddleNumber?: number;
        checkedInAt?: string;
        bidLimit?: string;
      };
    };
    const data = json.data;
    if (!data?.registrationId || data.paddleNumber == null || !data.checkedInAt) {
      return actionFailure("Unexpected response from server");
    }
    return actionSuccess({
      registrationId: data.registrationId,
      paddleNumber: data.paddleNumber,
      checkedInAt: data.checkedInAt,
      ...(data.bidLimit != null ? { bidLimit: data.bidLimit } : {}),
    });
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
    const res = await authedServerFetch(
      `/admin/sales/${encodeURIComponent(saleId)}/registrations/${encodeURIComponent(registrationId)}/paddle`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paddleNumber != null ? { paddleNumber } : {}),
      },
    );

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return actionFailure(payload.error ?? "Paddle assignment failed");
    }

    const json = (await res.json()) as { data?: { paddleNumber?: number } };
    const assigned = json.data?.paddleNumber;
    if (assigned == null) return actionFailure("Unexpected response from server");
    return actionSuccess({ paddleNumber: assigned });
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
    const res = await authedServerFetch(
      `/admin/sales/${encodeURIComponent(saleId)}/registrations/${encodeURIComponent(registrationId)}/paddle`,
      { method: "DELETE" },
    );

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return actionFailure(payload.error ?? "Clear paddle failed");
    }

    return actionSuccess({ ok: true });
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

    const body = parsed.data;
    const res = await authedServerFetch("/admin/saleroom/paddle-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId: body.saleId,
        lotId: body.lotId,
        paddleNumber: body.paddleNumber,
        amount: body.amount,
        ...(body.maxAutoBidAmount != null ? { maxAutoBidAmount: body.maxAutoBidAmount } : {}),
      }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return actionFailure(payload.error ?? "Paddle bid failed");
    }

    const json = (await res.json()) as { data?: { id?: string } };
    const bidId = json.data?.id;
    if (!bidId) return actionFailure("Unexpected response from server");
    return actionSuccess({ bidId });
  });
}
