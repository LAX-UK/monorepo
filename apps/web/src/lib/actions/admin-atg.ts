"use server";

import { humanizeAtgAdminError } from "@/lib/atg/admin-atg-errors";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  ATG_AUCTION_TYPES,
  ATG_DISTRIBUTIONS,
  type AtgSaleSettings,
  type AtgSyncAction,
  type AtgSyncJobState,
} from "@auction/types";
import { z } from "zod";

const saleActionSchema = z.object({
  saleId: z.string().uuid(),
  action: z.enum(["push", "publish", "close"]),
});

/** Queue an ATG push / publish / close for a sale; the worker performs the sync. */
export async function adminAtgSaleActionResultAction(
  saleId: string,
  action: AtgSyncAction,
): Promise<ActionResult<{ jobId: string }>> {
  return instrumentServerAction("adminAtgSaleActionResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;

    const parsed = saleActionSchema.safeParse({ saleId, action });
    if (!parsed.success) return actionFailure("Invalid ATG action");

    const res = await authedServerFetch(
      `/admin/integrations/atg/sales/${parsed.data.saleId}/${parsed.data.action}`,
      { method: "POST", skipActingLegalEntityHeader: true },
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: { jobId: string };
      error?: unknown;
      code?: string;
    };
    if (!res.ok) {
      const code = typeof body.code === "string" ? body.code : undefined;
      const raw =
        typeof body.error === "string"
          ? body.error
          : body.error != null && typeof body.error === "object" && "message" in body.error
            ? String((body.error as { message: unknown }).message)
            : "atg_action_failed";
      return actionFailure(humanizeAtgAdminError(code, raw), undefined, res.status, code);
    }
    if (!body.data) return actionFailure("invalid_response");
    return actionSuccess(body.data);
  });
}

const saleSettingsSchema = z.object({
  saleId: z.string().uuid(),
  auctionType: z.enum(ATG_AUCTION_TYPES),
  distribution: z.enum(ATG_DISTRIBUTIONS),
  confirmPublic: z.boolean(),
});

/** Save the sale's ATG auction type and distribution; a linked sale is re-pushed. */
export async function adminAtgSaleSettingsAction(
  saleId: string,
  settings: AtgSaleSettings,
  confirmPublic: boolean,
): Promise<ActionResult<{ settings: AtgSaleSettings; pushJobId: string | null }>> {
  return instrumentServerAction("adminAtgSaleSettingsAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;

    const parsed = saleSettingsSchema.safeParse({ saleId, ...settings, confirmPublic });
    if (!parsed.success) return actionFailure("Invalid ATG settings");
    const { saleId: id, ...body } = parsed.data;

    const res = await authedServerFetch(`/admin/integrations/atg/sales/${id}/settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      skipActingLegalEntityHeader: true,
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { settings: AtgSaleSettings; pushJobId: string | null };
      error?: unknown;
      code?: string;
    };
    if (!res.ok) {
      const code = typeof json.code === "string" ? json.code : undefined;
      const raw = typeof json.error === "string" ? json.error : "atg_action_failed";
      return actionFailure(humanizeAtgAdminError(code, raw), undefined, res.status, code);
    }
    if (!json.data) return actionFailure("invalid_response");
    return actionSuccess(json.data);
  });
}

const jobIdSchema = z.string().min(1);

/** Poll BullMQ job state for the ATG tab after push / publish / close. */
export async function adminAtgJobStateAction(
  jobId: string,
): Promise<ActionResult<{ state: AtgSyncJobState }>> {
  return instrumentServerAction("adminAtgJobStateAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;

    const parsed = jobIdSchema.safeParse(jobId);
    if (!parsed.success) return actionFailure("Invalid job id");

    const res = await authedServerFetch(
      `/admin/integrations/atg/jobs/${encodeURIComponent(parsed.data)}`,
      { skipActingLegalEntityHeader: true },
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: { state: AtgSyncJobState };
      error?: unknown;
      code?: string;
    };
    if (!res.ok) {
      const code = typeof body.code === "string" ? body.code : undefined;
      return actionFailure(
        humanizeAtgAdminError(code, "Could not load ATG job status"),
        undefined,
        res.status,
        code,
      );
    }
    if (!body.data?.state) return actionFailure("invalid_response");
    return actionSuccess(body.data);
  });
}
