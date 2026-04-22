"use server";

import {
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  type ActionResult,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { approveSubmissionBodySchema, rejectSubmissionBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

export async function adminStartSubmissionReviewAction(formData: FormData): Promise<void> {
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
}

export async function adminApproveSubmissionAction(formData: FormData): Promise<void> {
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
}

export async function adminRejectSubmissionAction(formData: FormData): Promise<void> {
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
}

export async function adminStartSubmissionReviewResultAction(
  submissionId: string,
): Promise<ActionResult<void>> {
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
}

export async function adminApproveSubmissionResultAction(
  submissionId: string,
  body: z.infer<typeof approveSubmissionBodySchema>,
): Promise<ActionResult<{ lotId: string | undefined }>> {
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
}

export async function adminRejectSubmissionResultAction(
  submissionId: string,
  body: z.infer<typeof rejectSubmissionBodySchema>,
): Promise<ActionResult<void>> {
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
}
