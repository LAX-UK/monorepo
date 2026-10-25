"use server";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { CONDITION_REPORTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const requestIdSchema = z.string().trim().uuid();

const fulfilSchema = z.object({
  summary: z.string().trim().max(5000),
  details: z.string().trim().max(10_000),
  downloadUrl: z.string().trim().max(2048),
  responseNote: z.string().trim().max(2000),
});

export type FulfilConditionReportInput = z.input<typeof fulfilSchema>;

export async function adminMarkConditionReportInProgressResultAction(
  requestId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminMarkConditionReportInProgressResultAction", async () => {
    const denied = await denyUnlessAdminCapability(CONDITION_REPORTS_ACCESS);
    if (denied) return denied;
    const id = requestIdSchema.safeParse(requestId);
    if (!id.success) return actionFailure("Missing request");
    const res = await getWriteContainer().adminConditionReports.markInProgress(id.data);
    if (!res.ok) {
      return actionFailure(
        res.message,
        undefined,
        res.status,
        res.code,
        readApiActionErrorMeta(res.body),
      );
    }
    revalidatePath("/admin/condition-reports");
    return actionSuccess();
  });
}

/** Publishes the report on the lot page; at least a summary, details or a file is needed. */
export async function adminFulfilConditionReportResultAction(
  requestId: string,
  input: FulfilConditionReportInput,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminFulfilConditionReportResultAction", async () => {
    const denied = await denyUnlessAdminCapability(CONDITION_REPORTS_ACCESS);
    if (denied) return denied;
    const id = requestIdSchema.safeParse(requestId);
    if (!id.success) return actionFailure("Missing request");
    const parsed = fulfilSchema.safeParse(input);
    if (!parsed.success) return actionFailure("Check the details and try again");
    const { summary, details, downloadUrl, responseNote } = parsed.data;
    if (!summary && !details && !downloadUrl) {
      return actionFailure("Add a summary, details or a file");
    }
    const conditionReport: { summary?: string; details?: string; downloadUrl?: string } = {};
    if (summary) conditionReport.summary = summary;
    if (details) conditionReport.details = details;
    if (downloadUrl) conditionReport.downloadUrl = downloadUrl;
    const res = await getWriteContainer().adminConditionReports.fulfill(id.data, {
      conditionReport,
      ...(responseNote ? { responseNote } : {}),
    });
    if (!res.ok) return actionFailure(res.message, undefined, res.status, res.code);
    revalidatePath("/admin/condition-reports");
    return actionSuccess();
  });
}

/** Declines the request; the reason is kept with it and shown on the closed request. */
export async function adminDeclineConditionReportResultAction(
  requestId: string,
  reason?: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminDeclineConditionReportResultAction", async () => {
    const denied = await denyUnlessAdminCapability(CONDITION_REPORTS_ACCESS);
    if (denied) return denied;
    const id = requestIdSchema.safeParse(requestId);
    if (!id.success) return actionFailure("Missing request");
    const trimmed = reason?.trim().slice(0, 2000);
    const res = await getWriteContainer().adminConditionReports.decline(
      id.data,
      trimmed || undefined,
    );
    if (!res.ok) return actionFailure(res.message, undefined, res.status, res.code);
    revalidatePath("/admin/condition-reports");
    return actionSuccess();
  });
}
