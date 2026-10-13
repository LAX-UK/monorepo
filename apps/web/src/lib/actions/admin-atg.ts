"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { AtgSyncAction } from "@auction/types";
import { normalizeApiErrorMessage } from "@auction/validators";
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
      return actionFailure(
        normalizeApiErrorMessage(body.error, "atg_action_failed"),
        undefined,
        res.status,
        body.code,
      );
    }
    if (!body.data) return actionFailure("invalid_response");
    return actionSuccess(body.data);
  });
}
