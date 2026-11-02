"use server";

import { enquiryHref } from "@/lib/admin/enquiries/enquiries-search";
import { ENQUIRIES_PATH } from "@/lib/admin/enquiries/enquiries.vm";
import { enquiryErrorMessage } from "@/lib/admin/enquiries/enquiry-errors";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import {
  type EnquiryRule,
  type EnquiryView,
  enquiryRoutingSchema,
  enquiryViewSchema,
} from "@/lib/data/http/admin-enquiries.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import {
  ENQUIRY_ASSIGN_ACCESS,
  ENQUIRY_ROUTING_MANAGE_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  adminEnquiryPatchSchema,
  adminEnquiryRoutingSchema,
  enquiryRefParamSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";

async function errorCodeOf(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : undefined;
}

/**
 * One change to an enquiry: assign it, move its status, close it with a reason, or add a note.
 * The change carries the version the person was looking at; a newer version answers
 * `stale_version`, so the page can offer a reload instead of overwriting someone's work.
 */
export async function updateEnquiryAction(
  ref: string,
  input: unknown,
): Promise<ActionResult<EnquiryView>> {
  return instrumentServerAction("updateEnquiryAction", async () => {
    const denied = await denyUnlessAdminCapability(ENQUIRY_ASSIGN_ACCESS);
    if (denied) return denied;
    const param = enquiryRefParamSchema.safeParse({ ref });
    const patch = adminEnquiryPatchSchema.safeParse(input);
    if (!param.success || !patch.success) {
      return actionFailure(patch.error?.issues[0]?.message ?? "Check the details.", undefined, 400);
    }
    const res = await authedServerFetch(`/admin/enquiries/${encodeURIComponent(param.data.ref)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch.data),
    }).catch(() => null);
    if (!res) return actionFailure(enquiryErrorMessage(undefined, undefined), undefined, 503);
    if (!res.ok) {
      const code = await errorCodeOf(res);
      return actionFailure(enquiryErrorMessage(code, res.status), undefined, res.status, code);
    }
    const enquiry = readDataEnvelope(
      await readJsonBody(res),
      enquiryViewSchema,
      "PATCH /admin/enquiries/:ref",
    );
    revalidatePath(ENQUIRIES_PATH);
    revalidatePath(enquiryHref(enquiry.reference));
    return actionSuccess(enquiry);
  });
}

/** Replaces the routing table: one specialist per department, and the fallback. */
export async function saveEnquiryRoutingAction(
  rules: readonly EnquiryRule[],
): Promise<ActionResult<EnquiryRule[]>> {
  return instrumentServerAction("saveEnquiryRoutingAction", async () => {
    const denied = await denyUnlessAdminCapability(ENQUIRY_ROUTING_MANAGE_ACCESS);
    if (denied) return denied;
    const parsed = adminEnquiryRoutingSchema.safeParse({ rules });
    if (!parsed.success) {
      return actionFailure(parsed.error.issues[0]?.message ?? "Check the routing.", undefined, 400);
    }
    const res = await authedServerFetch("/admin/enquiry-routing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    if (!res) return actionFailure(enquiryErrorMessage(undefined, undefined), undefined, 503);
    if (!res.ok) {
      const code = await errorCodeOf(res);
      return actionFailure(enquiryErrorMessage(code, res.status), undefined, res.status, code);
    }
    const saved = readDataEnvelope(
      await readJsonBody(res),
      enquiryRoutingSchema,
      "PUT /admin/enquiry-routing",
    );
    revalidatePath(ENQUIRIES_PATH);
    return actionSuccess(saved.rules);
  });
}
