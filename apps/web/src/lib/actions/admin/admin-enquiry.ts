"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { adminEnquirySchema } from "@/lib/data/http/admin-enquiry.reader";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { MARKETING_ENQUIRIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { marketingEnquiryIdParamSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

const ALREADY_HANDLED = "Someone has already marked this enquiry handled.";

/** Marks a contact enquiry handled. The API records who did it in the audit log. */
export async function markEnquiryHandledAction(id: string): Promise<ActionResult<void>> {
  return instrumentServerAction("markEnquiryHandledAction", async () => {
    const denied = await denyUnlessAdminCapability(MARKETING_ENQUIRIES_ACCESS);
    if (denied) return denied;
    const parsed = marketingEnquiryIdParamSchema.safeParse({ id });
    if (!parsed.success) return actionFailure("This enquiry could not be found.", undefined, 400);

    const res = await authedServerFetch(`/admin/enquiries/${parsed.data.id}/handled`, {
      method: "POST",
    });
    if (res.status === 409) return actionFailure(ALREADY_HANDLED, undefined, 409);
    if (!res.ok) {
      return actionFailure(
        "The enquiry was not marked handled. Try again in a moment.",
        undefined,
        res.status,
      );
    }
    readDataEnvelope(
      await readJsonBody(res),
      adminEnquirySchema,
      "POST /admin/enquiries/:id/handled",
    );
    revalidatePath(`/admin/enquiries/${parsed.data.id}`);
    revalidatePath("/admin");
    return actionSuccess();
  });
}
