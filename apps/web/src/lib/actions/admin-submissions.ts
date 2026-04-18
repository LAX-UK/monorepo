"use server";

import { authedJsonRedirect } from "@/lib/actions/_helpers";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { approveSubmissionBodySchema, rejectSubmissionBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function adminStartSubmissionReviewAction(formData: FormData): Promise<void> {
  const id = String(formData.get("submissionId") ?? "").trim();
  if (!id) redirect(`/admin/submissions?error=${encodeURIComponent("Missing submission")}`);
  await authedJsonRedirect({
    path: `/submissions/${encodeURIComponent(id)}/review/start`,
    method: "POST",
    okRedirect: `/admin/submissions/${id}`,
    errRedirect: `/admin/submissions/${id}`,
    revalidatePaths: ["/admin/submissions", `/admin/submissions/${id}`],
  });
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
  const res = await authedServerFetch(`/submissions/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(
      `/admin/submissions/${id}?error=${encodeURIComponent(String((body as { error?: string }).error ?? "Approve failed"))}`,
    );
  }
  const lotId = String((body as { data?: { lot?: { id?: string } } }).data?.lot?.id ?? "");
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
  await authedJsonRedirect({
    path: `/submissions/${encodeURIComponent(id)}/reject`,
    method: "POST",
    json: parsed.data,
    okRedirect: `/admin/submissions/${id}`,
    errRedirect: `/admin/submissions/${id}`,
    revalidatePaths: ["/admin/submissions", `/admin/submissions/${id}`],
  });
}
