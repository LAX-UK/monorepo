"use server";

import { assertAdminCapabilityForRedirect } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
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
      const res = await authedServerFetch(
        `/admin/condition-report-requests/${encodeURIComponent(parsed.data.requestId)}/mark-in-progress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(payload.error ?? "Could not mark in progress")}`,
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

      const res = await authedServerFetch(
        `/admin/condition-report-requests/${encodeURIComponent(parsed.data.requestId)}/fulfill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conditionReport,
            ...(responseNote ? { responseNote } : {}),
          }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(payload.error ?? "Fulfil failed")}`,
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
      const res = await authedServerFetch(
        `/admin/condition-report-requests/${encodeURIComponent(parsed.data.requestId)}/decline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(responseNote ? { responseNote } : {}),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        redirect(
          `/admin/condition-reports?error=${encodeURIComponent(payload.error ?? "Decline failed")}`,
        );
      }
      revalidatePath("/admin/condition-reports");
      redirect("/admin/condition-reports");
    },
    { formData },
  );
}
