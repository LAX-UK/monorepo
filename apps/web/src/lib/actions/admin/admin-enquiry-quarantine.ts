"use server";

import { enquiryHref } from "@/lib/admin/enquiries/enquiries-search";
import { ENQUIRIES_PATH } from "@/lib/admin/enquiries/enquiries.vm";
import {
  QUARANTINE_PATH,
  quarantineErrorMessage,
  quarantineHref,
} from "@/lib/admin/enquiries/quarantine.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import {
  type QuarantineAttached,
  quarantineAttachedSchema,
} from "@/lib/data/http/admin-enquiries.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { ENQUIRY_ASSIGN_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  adminEnquiryQuarantineAttachSchema,
  enquiryQuarantineParamSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";

async function errorCodeOf(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : undefined;
}

function refreshQuarantine(id: string): void {
  revalidatePath(QUARANTINE_PATH);
  revalidatePath(quarantineHref(id));
}

/**
 * Attaches one held email to one enquiry: the one its reply address named, or one the person
 * picked by reference. The Bid API checks the capability and the enquiry again, and audits it.
 */
export async function attachQuarantinedEmailAction(
  id: string,
  input: unknown,
): Promise<ActionResult<QuarantineAttached>> {
  return instrumentServerAction("attachQuarantinedEmailAction", async () => {
    const denied = await denyUnlessAdminCapability(ENQUIRY_ASSIGN_ACCESS);
    if (denied) return denied;
    const param = enquiryQuarantineParamSchema.safeParse({ id });
    const body = adminEnquiryQuarantineAttachSchema.safeParse(input);
    if (!param.success || !body.success) {
      return actionFailure(quarantineErrorMessage("enquiry_not_found", 400), undefined, 400);
    }
    const res = await authedServerFetch(`/admin/enquiry-quarantine/${param.data.id}/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.data),
    }).catch(() => null);
    if (!res) return actionFailure(quarantineErrorMessage(undefined, undefined), undefined, 503);
    if (!res.ok) {
      const code = await errorCodeOf(res);
      return actionFailure(quarantineErrorMessage(code, res.status), undefined, res.status, code);
    }
    const attached = readDataEnvelope(
      await readJsonBody(res),
      quarantineAttachedSchema,
      "POST /admin/enquiry-quarantine/:id/attach",
    );
    refreshQuarantine(param.data.id);
    revalidatePath(ENQUIRIES_PATH);
    revalidatePath(enquiryHref(attached.enquiryReference));
    return actionSuccess(attached);
  });
}

/** Discards one held email: it stays off every enquiry until it is deleted. Audited by the API. */
export async function discardQuarantinedEmailAction(id: string): Promise<ActionResult<null>> {
  return instrumentServerAction("discardQuarantinedEmailAction", async () => {
    const denied = await denyUnlessAdminCapability(ENQUIRY_ASSIGN_ACCESS);
    if (denied) return denied;
    const param = enquiryQuarantineParamSchema.safeParse({ id });
    if (!param.success) {
      return actionFailure(quarantineErrorMessage("quarantine_not_found", 400), undefined, 400);
    }
    const res = await authedServerFetch(`/admin/enquiry-quarantine/${param.data.id}/discard`, {
      method: "POST",
    }).catch(() => null);
    if (!res) return actionFailure(quarantineErrorMessage(undefined, undefined), undefined, 503);
    if (!res.ok) {
      const code = await errorCodeOf(res);
      return actionFailure(quarantineErrorMessage(code, res.status), undefined, res.status, code);
    }
    refreshQuarantine(param.data.id);
    return actionSuccess(null);
  });
}
