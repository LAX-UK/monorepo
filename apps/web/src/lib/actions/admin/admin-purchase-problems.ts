"use server";

import { purchaseProblemErrorMessage } from "@/lib/admin/purchase-problems/purchase-problem-errors";
import { purchaseProblemHref } from "@/lib/admin/purchase-problems/purchase-problems-search";
import { PURCHASE_PROBLEMS_PATH } from "@/lib/admin/purchase-problems/purchase-problems.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import {
  type PurchaseProblemView,
  purchaseProblemViewSchema,
} from "@/lib/data/http/admin-purchase-problems.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { PURCHASE_PROBLEMS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { adminPurchaseProblemPatchSchema, purchaseProblemIdParamSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

async function errorCodeOf(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : undefined;
}

/**
 * One change to a purchase problem: take it on, give it to a colleague, resolve it with a note,
 * or add a note. The change carries the version the person was looking at; a newer version
 * answers `stale_version`, so the page can offer a reload instead of overwriting someone's work.
 */
export async function updatePurchaseProblemAction(
  id: string,
  input: unknown,
): Promise<ActionResult<PurchaseProblemView>> {
  return instrumentServerAction("updatePurchaseProblemAction", async () => {
    const denied = await denyUnlessAdminCapability(PURCHASE_PROBLEMS_ACCESS);
    if (denied) return denied;
    const param = purchaseProblemIdParamSchema.safeParse({ id });
    const patch = adminPurchaseProblemPatchSchema.safeParse(input);
    if (!param.success || !patch.success) {
      return actionFailure(patch.error?.issues[0]?.message ?? "Check the details.", undefined, 400);
    }
    const res = await authedServerFetch(
      `/admin/purchase-problems/${encodeURIComponent(param.data.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch.data),
      },
    ).catch(() => null);
    if (!res) {
      return actionFailure(purchaseProblemErrorMessage(undefined, undefined), undefined, 503);
    }
    if (!res.ok) {
      const code = await errorCodeOf(res);
      return actionFailure(
        purchaseProblemErrorMessage(code, res.status),
        undefined,
        res.status,
        code,
      );
    }
    const problem = readDataEnvelope(
      await readJsonBody(res),
      purchaseProblemViewSchema,
      "PATCH /admin/purchase-problems/:id",
    );
    revalidatePath(PURCHASE_PROBLEMS_PATH);
    revalidatePath(purchaseProblemHref(problem.id));
    return actionSuccess(problem);
  });
}
