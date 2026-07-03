"use server";

import { readApiError } from "@/lib/actions/_utils";
import { assertAdminCapabilityForRedirect } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
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
