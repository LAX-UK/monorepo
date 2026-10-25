"use server";

import { readApiError } from "@/lib/actions/_utils";
import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const saleRegistrationActionParams = z.object({
  saleId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

export async function adminApproveSaleRegistrationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminApproveSaleRegistrationAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales?error=${encodeURIComponent(denied.message)}`);
      }
      const parsed = saleRegistrationActionParams.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        registrationId: String(formData.get("registrationId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/sales?error=${encodeURIComponent("Invalid registration")}`);
      }
      const { saleId, registrationId } = parsed.data;
      const res = await getWriteContainer().adminSaleRegistrations.approve(saleId, registrationId);
      if (!res.ok) {
        redirect(
          `/admin/sales/${encodeURIComponent(saleId)}/registrations?error=${encodeURIComponent(readApiError(res.body, "Approve failed"))}`,
        );
      }
      revalidatePath(`/admin/sales/${saleId}/registrations`);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/registrations`);
    },
    { formData },
  );
}

export async function adminRejectSaleRegistrationAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminRejectSaleRegistrationAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales?error=${encodeURIComponent(denied.message)}`);
      }
      const parsed = saleRegistrationActionParams.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        registrationId: String(formData.get("registrationId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/sales?error=${encodeURIComponent("Invalid registration")}`);
      }
      const { saleId, registrationId } = parsed.data;
      const reasonRaw = String(formData.get("reason") ?? "").trim();
      const res = await getWriteContainer().adminSaleRegistrations.reject(
        saleId,
        registrationId,
        reasonRaw || undefined,
      );
      if (!res.ok) {
        redirect(
          `/admin/sales/${encodeURIComponent(saleId)}/registrations?error=${encodeURIComponent(readApiError(res.body, "Reject failed"))}`,
        );
      }
      revalidatePath(`/admin/sales/${saleId}/registrations`);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/registrations`);
    },
    { formData },
  );
}

export async function adminUpdateSaleRegistrationBidLimitAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminUpdateSaleRegistrationBidLimitAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales?error=${encodeURIComponent(denied.message)}`);
      }
      const parsed = saleRegistrationActionParams.safeParse({
        saleId: String(formData.get("saleId") ?? "").trim(),
        registrationId: String(formData.get("registrationId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/sales?error=${encodeURIComponent("Invalid registration")}`);
      }
      const { saleId, registrationId } = parsed.data;
      const limitRaw = String(formData.get("bidLimit") ?? "").trim();
      const bidLimit =
        limitRaw === ""
          ? null
          : (() => {
              const n = Number.parseFloat(limitRaw);
              return Number.isFinite(n) && n > 0 ? n : null;
            })();
      const res = await getWriteContainer().adminSaleRegistrations.updateBidLimit(
        saleId,
        registrationId,
        bidLimit,
      );
      if (!res.ok) {
        redirect(
          `/admin/sales/${encodeURIComponent(saleId)}/registrations?error=${encodeURIComponent(readApiError(res.body, "Could not update bid limit"))}`,
        );
      }
      revalidatePath(`/admin/sales/${saleId}/registrations`);
      redirect(`/admin/sales/${encodeURIComponent(saleId)}/registrations`);
    },
    { formData },
  );
}

const saleRegistrationDecisionInput = saleRegistrationActionParams.extend({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Approves or rejects a registration and answers with a result, so the dialog that asked can keep
 * a failure in view. A rejection may carry a reason, which is kept with the registration.
 */
export async function adminDecideSaleRegistrationResultAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminDecideSaleRegistrationResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const parsed = saleRegistrationDecisionInput.safeParse(input);
    if (!parsed.success) return actionFailure(firstZodErrorMessage(parsed.error));
    const { saleId, registrationId, decision, reason } = parsed.data;
    const registrations = getWriteContainer().adminSaleRegistrations;
    const res =
      decision === "approve"
        ? await registrations.approve(saleId, registrationId)
        : await registrations.reject(saleId, registrationId, reason || undefined);
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, decision === "approve" ? "Approve failed" : "Reject failed"),
        undefined,
        res.status,
        res.code,
      );
    }
    revalidatePath(`/admin/sales/${saleId}/registrations`);
    return actionSuccess();
  });
}
