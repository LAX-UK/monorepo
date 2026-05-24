"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { approveSubmissionBodySchema, rejectSubmissionBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

export async function adminStartSubmissionReviewAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminStartSubmissionReviewAction",
    async () => {
      const id = String(formData.get("submissionId") ?? "").trim();
      if (!id) redirect(`/admin/submissions?error=${encodeURIComponent("Missing submission")}`);
      const { adminSubmissions } = getWriteContainer();
      const r = await adminSubmissions.startReview(id);
      if (!r.ok) {
        redirect(`/admin/submissions/${id}?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/submissions");
      revalidatePath(`/admin/submissions/${id}`);
      redirect(`/admin/submissions/${id}`);
    },
    { formData },
  );
}

export async function adminApproveSubmissionAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminApproveSubmissionAction",
    async () => {
      const id = String(formData.get("submissionId") ?? "").trim();
      if (!id) redirect(`/admin/submissions?error=${encodeURIComponent("Missing submission")}`);
      const parsed = approveSubmissionBodySchema.safeParse({
        reviewNotes: String(formData.get("reviewNotes") ?? "").trim() || undefined,
      });
      if (!parsed.success) {
        redirect(`/admin/submissions/${id}?error=${encodeURIComponent("Invalid form")}`);
      }
      const { adminSubmissions } = getWriteContainer();
      const r = await adminSubmissions.approve(id, parsed.data);
      if (!r.ok) {
        redirect(`/admin/submissions/${id}?error=${encodeURIComponent(r.message)}`);
      }
      const lotId = r.data.lotId;
      revalidatePath("/admin/submissions");
      revalidatePath(`/admin/submissions/${id}`);
      revalidatePath("/admin/lots");
      if (lotId) {
        redirect(`/admin/lots/${lotId}`);
      }
      redirect(`/admin/submissions/${id}`);
    },
    { formData },
  );
}

export async function adminRejectSubmissionAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminRejectSubmissionAction",
    async () => {
      const id = String(formData.get("submissionId") ?? "").trim();
      if (!id) redirect(`/admin/submissions?error=${encodeURIComponent("Missing submission")}`);
      const parsed = rejectSubmissionBodySchema.safeParse({
        rejectionReason: String(formData.get("rejectionReason") ?? "").trim(),
        reviewNotes: String(formData.get("reviewNotes") ?? "").trim() || undefined,
      });
      if (!parsed.success) {
        redirect(`/admin/submissions/${id}?error=${encodeURIComponent("Invalid form")}`);
      }
      const { adminSubmissions } = getWriteContainer();
      const r = await adminSubmissions.reject(id, parsed.data);
      if (!r.ok) {
        redirect(`/admin/submissions/${id}?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/submissions");
      revalidatePath(`/admin/submissions/${id}`);
      redirect(`/admin/submissions/${id}`);
    },
    { formData },
  );
}

export async function adminStartSubmissionReviewResultAction(
  submissionId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminStartSubmissionReviewResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;
    const id = submissionId.trim();
    if (!id) {
      return actionFailure("Missing submission");
    }
    const { adminSubmissions } = getWriteContainer();
    const r = await adminSubmissions.startReview(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${id}`);
    return actionSuccess();
  });
}

export async function adminApproveSubmissionResultAction(
  submissionId: string,
  body: z.infer<typeof approveSubmissionBodySchema>,
): Promise<ActionResult<{ lotId: string | undefined }>> {
  return instrumentServerAction("adminApproveSubmissionResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;
    const id = submissionId.trim();
    if (!id) {
      return actionFailure("Missing submission");
    }
    const parsed = approveSubmissionBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminSubmissions } = getWriteContainer();
    const r = await adminSubmissions.approve(id, parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    const lotId = r.data.lotId;
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${id}`);
    revalidatePath("/admin/lots");
    return actionSuccess({ lotId });
  });
}

export async function adminRejectSubmissionResultAction(
  submissionId: string,
  body: z.infer<typeof rejectSubmissionBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRejectSubmissionResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;
    const id = submissionId.trim();
    if (!id) {
      return actionFailure("Missing submission");
    }
    const parsed = rejectSubmissionBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminSubmissions } = getWriteContainer();
    const r = await adminSubmissions.reject(id, parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${id}`);
    return actionSuccess();
  });
}
