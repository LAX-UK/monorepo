"use server";

import {
  adminApproveSubmissionResultAction,
  adminAssignSubmissionResultAction,
  adminRejectSubmissionResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import { recordDashboardTelemetry } from "@/lib/admin/dashboard/dashboard-telemetry";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import type { AdminWorkItemAction } from "@/lib/data/http/admin-work-items.schema";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import {
  CONDITION_REPORTS_ACCESS,
  FINANCE_ACCESS,
  LOT_FULFILMENT_ACCESS,
  SALES_ACCESS,
  SUBMISSIONS_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const workItemActionInput = z.object({
  itemId: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  action: z.string().trim().min(1),
  saleId: z.string().trim().optional(),
  registrationId: z.string().trim().optional(),
  bookingId: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

function entityId(itemId: string): string {
  const parts = itemId.split(":");
  return parts.length > 1 ? (parts[1] ?? itemId) : itemId;
}

async function runWithTelemetry(
  kind: string,
  action: string,
  fn: () => Promise<ActionResult<void>>,
): Promise<ActionResult<void>> {
  const result = await fn();
  if (result.ok) {
    recordDashboardTelemetry({
      kind: "work_item_action",
      itemKind: kind,
      action,
    });
  }
  return result;
}

export async function executeWorkItemActionAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("executeWorkItemActionAction", async () => {
    const parsed = workItemActionInput.safeParse(input);
    if (!parsed.success) return actionFailure("Invalid work item action");
    const { itemId, kind, action, saleId, registrationId, bookingId, notes } = parsed.data;
    const id = entityId(itemId);

    switch (action as AdminWorkItemAction) {
      case "start_review": {
        const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, () => adminStartSubmissionReviewResultAction(id));
      }
      case "approve": {
        const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, async () => {
          const res = await adminApproveSubmissionResultAction(id, {
            reviewNotes: notes,
          });
          if (!res.ok) return res;
          return actionSuccess();
        });
      }
      case "reject": {
        const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, () =>
          adminRejectSubmissionResultAction(id, {
            rejectionReason: notes ?? "Rejected from dashboard inbox",
          }),
        );
      }
      case "assign_to_me": {
        const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
        if (denied) return denied;
        const user = await requireAuthenticatedUser({
          shell: "staff",
          loginNext: "/admin",
        });
        return runWithTelemetry(kind, action, () => adminAssignSubmissionResultAction(id, user.id));
      }
      case "capture": {
        const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminPayments.capture(id);
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "refund": {
        const denied = await denyUnlessAdminCapability(FINANCE_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminPayments.refund(id);
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "mark_in_progress": {
        const denied = await denyUnlessAdminCapability(CONDITION_REPORTS_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminConditionReports.markInProgress(id);
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "decline": {
        const denied = await denyUnlessAdminCapability(CONDITION_REPORTS_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminConditionReports.decline(id, notes);
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "approve_registration": {
        const denied = await denyUnlessAdminCapability(SALES_ACCESS);
        if (denied) return denied;
        if (!saleId || !registrationId) return actionFailure("Missing registration context");
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminSaleRegistrations.approve(
            saleId,
            registrationId,
          );
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "reject_registration": {
        const denied = await denyUnlessAdminCapability(SALES_ACCESS);
        if (denied) return denied;
        if (!saleId || !registrationId) return actionFailure("Missing registration context");
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminSaleRegistrations.reject(
            saleId,
            registrationId,
            notes ?? undefined,
          );
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "confirm_telephone": {
        const denied = await denyUnlessAdminCapability(SALES_ACCESS);
        if (denied) return denied;
        if (!saleId || !bookingId) return actionFailure("Missing telephone booking context");
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminTelephone.bookingAction(
            saleId,
            bookingId,
            "confirm",
          );
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "assign_clerk": {
        const denied = await denyUnlessAdminCapability(SALES_ACCESS);
        if (denied) return denied;
        if (!saleId || !bookingId) return actionFailure("Missing telephone booking context");
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminTelephone.bookingAction(
            saleId,
            bookingId,
            "assign-clerk",
          );
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "release_fulfilment": {
        const denied = await denyUnlessAdminCapability(LOT_FULFILMENT_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminLotFulfilment.release(id, {});
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "ready_for_collection": {
        const denied = await denyUnlessAdminCapability(LOT_FULFILMENT_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminLotFulfilment.readyForCollection(id);
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      case "delivered": {
        const denied = await denyUnlessAdminCapability(LOT_FULFILMENT_ACCESS);
        if (denied) return denied;
        return runWithTelemetry(kind, action, async () => {
          const res = await getWriteContainer().adminLotFulfilment.delivered(id);
          if (!res.ok) return actionFailure(res.message, undefined, res.status);
          revalidatePath("/admin");
          return actionSuccess();
        });
      }
      default:
        return actionFailure(`Unsupported action ${action} for kind ${kind}`);
    }
  });
}
