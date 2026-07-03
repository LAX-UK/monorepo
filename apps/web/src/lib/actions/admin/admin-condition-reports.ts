"use server";

import { readApiError } from "@/lib/actions/_utils";
import { assertAdminCapabilityForRedirect } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { CONDITION_REPORTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const conditionReportRequestIdActionSchema = z.object({
  requestId: z.string().uuid(),
});

export async function adminMarkConditionReportInProgressAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminMarkConditionReportInProgressAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(CONDITION_REPORTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent(denied.message)}`);
      }
      const parsed = conditionReportRequestIdActionSchema.safeParse({
        requestId: String(formData.get("requestId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent("Invalid request")}`);
      }
      const res = await getWriteContainer().adminConditionReports.markInProgress(
        parsed.data.requestId,
      );
      if (!res.ok) {
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(readApiError(res.body, "Could not mark in progress"))}`,
        );
      }
      revalidatePath("/admin/condition-reports");
      redirect("/admin/condition-reports?success=Condition%20report%20marked%20in%20progress");
    },
    { formData },
  );
}

export async function adminFulfillConditionReportAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminFulfillConditionReportAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(CONDITION_REPORTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent(denied.message)}`);
      }
      const parsed = conditionReportRequestIdActionSchema.safeParse({
        requestId: String(formData.get("requestId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent("Invalid request")}`);
      }
      const summary = String(formData.get("summary") ?? "").trim();
      const details = String(formData.get("details") ?? "").trim();
      const downloadUrl = String(formData.get("downloadUrl") ?? "").trim();
      const responseNote = String(formData.get("responseNote") ?? "").trim();
      if (!summary && !details && !downloadUrl) {
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent("Add summary, details, or PDF URL")}`,
        );
      }
      const conditionReport: {
        summary?: string;
        details?: string;
        downloadUrl?: string;
      } = {};
      if (summary) conditionReport.summary = summary;
      if (details) conditionReport.details = details;
      if (downloadUrl) conditionReport.downloadUrl = downloadUrl;

      const res = await getWriteContainer().adminConditionReports.fulfill(parsed.data.requestId, {
        conditionReport,
        ...(responseNote ? { responseNote } : {}),
      });
      if (!res.ok) {
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(readApiError(res.body, "Fulfil failed"))}`,
        );
      }
      revalidatePath("/admin/condition-reports");
      redirect("/admin/condition-reports");
    },
    { formData },
  );
}

export async function adminDeclineConditionReportAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminDeclineConditionReportAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(CONDITION_REPORTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent(denied.message)}`);
      }
      const parsed = conditionReportRequestIdActionSchema.safeParse({
        requestId: String(formData.get("requestId") ?? "").trim(),
      });
      if (!parsed.success) {
        redirect(`/admin/condition-reports?error=${encodeURIComponent("Invalid request")}`);
      }
      const responseNote = String(formData.get("responseNote") ?? "").trim();
      const res = await getWriteContainer().adminConditionReports.decline(
        parsed.data.requestId,
        responseNote || undefined,
      );
      if (!res.ok) {
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(readApiError(res.body, "Decline failed"))}`,
        );
      }
      revalidatePath("/admin/condition-reports");
      redirect("/admin/condition-reports");
    },
    { formData },
  );
}
