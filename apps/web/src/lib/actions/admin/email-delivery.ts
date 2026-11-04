"use server";

import { revalidateAdminUserDetailPaths } from "@/lib/actions/admin/_shared/revalidate-paths";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { liftEmailBlockResultSchema } from "@/lib/data/http/admin-email-delivery.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { EMAIL_BLOCK_LIFT_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { EmailProviderResult, LiftEmailBlockBody } from "@auction/types";
import { adminLiftEmailBlockBodySchema } from "@auction/validators";

const FALLBACK = "The block couldn’t be lifted. Nothing changed. Try again in a moment.";

/**
 * Lifts the block on a person's email address. The API decides again whether the signed-in
 * person may lift this block and whether it is still the one they saw; a block that changed
 * meanwhile comes back with who lifted it and when, so the dialog can say so.
 */
export async function liftEmailBlockAction(
  userId: string,
  body: LiftEmailBlockBody,
): Promise<ActionResult<{ provider: EmailProviderResult }>> {
  return instrumentServerAction("liftEmailBlockAction", async () => {
    const denied = await denyUnlessAdminCapability(EMAIL_BLOCK_LIFT_ACCESS);
    if (denied) return denied;
    const parsed = adminLiftEmailBlockBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(parsed.error.issues[0]?.message ?? FALLBACK, undefined, 400);
    }
    const res = await authedServerFetch(
      `/admin/users/${encodeURIComponent(userId)}/email-delivery/lift`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      },
    );
    if (!res.ok) {
      const payload = (await readJsonBody(res).catch(() => null)) as {
        error?: string;
        message?: string;
        liftedAt?: string | null;
        liftedBy?: { name: string | null } | null;
      } | null;
      revalidateAdminUserDetailPaths(userId);
      return actionFailure(
        payload?.message ?? FALLBACK,
        undefined,
        res.status,
        payload?.error,
        res.status === 409
          ? { liftedAt: payload?.liftedAt ?? null, liftedBy: payload?.liftedBy?.name ?? null }
          : undefined,
      );
    }
    const result = readDataEnvelope(
      await readJsonBody(res),
      liftEmailBlockResultSchema,
      "POST /admin/users/:id/email-delivery/lift",
    );
    revalidateAdminUserDetailPaths(userId);
    return actionSuccess(result);
  });
}
