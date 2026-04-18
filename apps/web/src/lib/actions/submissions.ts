"use server";

import { authedJsonRedirect } from "@/lib/actions/_helpers";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { createItemSubmissionSchema, updateItemSubmissionSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function splitUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createSubmissionAction(formData: FormData): Promise<void> {
  const imagesRaw = String(formData.get("images") ?? "");
  const parsed = createItemSubmissionSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    medium: String(formData.get("medium") ?? "").trim() || undefined,
    dimensions: String(formData.get("dimensions") ?? "").trim() || undefined,
    images: imagesRaw ? splitUrlLines(imagesRaw) : undefined,
    askingPrice: String(formData.get("askingPrice") ?? "").trim() || undefined,
    reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
    categoryId: String(formData.get("categoryId") ?? "").trim(),
    submitterNotes: String(formData.get("submitterNotes") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/dashboard/submissions/new?error=${encodeURIComponent(parsed.error.issues.map((e: { message: string }) => e.message).join("; "))}`,
    );
  }
  await authedJsonRedirect({
    path: "/submissions",
    method: "POST",
    json: parsed.data,
    okRedirect: "/dashboard/submissions",
    errRedirect: "/dashboard/submissions/new",
    revalidatePaths: ["/dashboard/submissions"],
  });
}

export async function updateSubmissionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("submissionId") ?? "").trim();
  if (!id) redirect(`/dashboard/submissions?error=${encodeURIComponent("Missing submission")}`);
  const imagesRaw = String(formData.get("images") ?? "");
  const parsed = updateItemSubmissionSchema.safeParse({
    title: String(formData.get("title") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    medium: String(formData.get("medium") ?? "").trim() || undefined,
    dimensions: String(formData.get("dimensions") ?? "").trim() || undefined,
    images: imagesRaw ? splitUrlLines(imagesRaw) : undefined,
    askingPrice: String(formData.get("askingPrice") ?? "").trim() || undefined,
    reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
    categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
    submitterNotes: String(formData.get("submitterNotes") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/dashboard/submissions/${id}?error=${encodeURIComponent(parsed.error.issues.map((e: { message: string }) => e.message).join("; "))}`,
    );
  }
  await authedJsonRedirect({
    path: `/submissions/${encodeURIComponent(id)}`,
    method: "PATCH",
    json: parsed.data,
    okRedirect: `/dashboard/submissions/${id}`,
    errRedirect: `/dashboard/submissions/${id}`,
    revalidatePaths: ["/dashboard/submissions", `/dashboard/submissions/${id}`],
  });
}

export async function submitForReviewAction(formData: FormData): Promise<void> {
  const id = String(formData.get("submissionId") ?? "").trim();
  if (!id) redirect(`/dashboard/submissions?error=${encodeURIComponent("Missing submission")}`);
  await authedJsonRedirect({
    path: `/submissions/${encodeURIComponent(id)}/submit`,
    method: "POST",
    okRedirect: `/dashboard/submissions/${id}`,
    errRedirect: `/dashboard/submissions/${id}`,
    revalidatePaths: ["/dashboard/submissions", `/dashboard/submissions/${id}`],
  });
}

export async function withdrawSubmissionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("submissionId") ?? "").trim();
  if (!id) redirect(`/dashboard/submissions?error=${encodeURIComponent("Missing submission")}`);
  await authedJsonRedirect({
    path: `/submissions/${encodeURIComponent(id)}/withdraw`,
    method: "POST",
    okRedirect: `/dashboard/submissions/${id}`,
    errRedirect: `/dashboard/submissions/${id}`,
    revalidatePaths: ["/dashboard/submissions", `/dashboard/submissions/${id}`],
  });
}
