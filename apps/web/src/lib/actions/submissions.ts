"use server";

import { mapServiceToActionVoid } from "@/lib/actions/map-service-result";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import {
  formValuesToCreateItemSubmissionInput,
  formValuesToUpdateItemSubmissionInput,
} from "@/lib/forms/submission/submission-form-data";
import {
  createItemSubmissionSchema,
  itemSubmissionFormSchema,
  updateItemSubmissionSchema,
} from "@auction/validators";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { revalidatePath } from "next/cache";

function parseFormDataToCreateInput(formData: FormData) {
  const categoryIdsRaw = String(formData.get("categoryIds") ?? formData.get("categoryId") ?? "");
  const parseJsonArray = (name: string) => {
    try {
      const raw = String(formData.get(name) ?? "[]");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const parseJsonStringArray = (name: string): string[] | undefined => {
    try {
      const raw = String(formData.get(name) ?? "").trim();
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return undefined;
      const out = parsed.map((x) => String(x).trim()).filter(Boolean);
      return out.length > 0 ? out : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    medium: String(formData.get("medium") ?? "").trim() || undefined,
    dimensions: String(formData.get("dimensions") ?? "").trim() || undefined,
    images: parseJsonStringArray("images"),
    yearOfWork: String(formData.get("yearOfWork") ?? "").trim() || undefined,
    isSigned: String(formData.get("isSigned") ?? "") === "true",
    signatureNote: String(formData.get("signatureNote") ?? "").trim() || undefined,
    edition: String(formData.get("edition") ?? "").trim() || undefined,
    conditionSelfReport: String(formData.get("conditionSelfReport") ?? "").trim() || undefined,
    provenance: parseJsonArray("provenance"),
    exhibitions: parseJsonArray("exhibitions"),
    askingPrice: String(formData.get("askingPrice") ?? "").trim() || undefined,
    reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
    categoryIds: categoryIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    submitterNotes: String(formData.get("submitterNotes") ?? "").trim() || undefined,
  };
}

function parseFormDataToUpdateInput(formData: FormData) {
  const full = parseFormDataToCreateInput(formData);
  return {
    title: full.title || undefined,
    description: full.description,
    medium: full.medium,
    dimensions: full.dimensions,
    images: full.images,
    yearOfWork: full.yearOfWork,
    isSigned: full.isSigned,
    signatureNote: full.signatureNote,
    edition: full.edition,
    conditionSelfReport: full.conditionSelfReport,
    provenance: full.provenance,
    exhibitions: full.exhibitions,
    askingPrice: full.askingPrice,
    reservePrice: full.reservePrice,
    categoryIds: full.categoryIds,
    submitterNotes: full.submitterNotes,
  };
}

/** RHF: validated form values → create submission. Returns `ActionResult` for field errors.
 */
export async function createSubmissionFromValuesAction(
  values: ItemSubmissionFormValues,
): Promise<ActionResult<{ redirectTo: string; id: string }>> {
  const formParsed = itemSubmissionFormSchema.safeParse(values);
  if (!formParsed.success) {
    return actionFailure(
      firstZodErrorMessage(formParsed.error),
      zodErrorToFieldErrors(formParsed.error),
    );
  }
  const input = formValuesToCreateItemSubmissionInput(formParsed.data);
  const apiParsed = createItemSubmissionSchema.safeParse(input);
  if (!apiParsed.success) {
    return actionFailure(
      firstZodErrorMessage(apiParsed.error),
      zodErrorToFieldErrors(apiParsed.error),
    );
  }
  const payload = apiParsed.data;
  if (payload == null) {
    return actionFailure("Invalid create payload");
  }
  const { submissions } = getWriteContainer();
  const r = await submissions.create(payload);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/dashboard/submissions");
  return actionSuccess({
    id: r.data.id,
    redirectTo: `/dashboard/submissions/${r.data.id}`,
  });
}

/** Back-compat: `FormData` (e.g. native forms, tests).
 */
export async function createSubmissionAction(formData: FormData): Promise<void> {
  const input = parseFormDataToCreateInput(formData);
  const parsed = createItemSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    const { redirect } = await import("next/navigation");
    redirect(
      `/dashboard/submissions/new?error=${encodeURIComponent(parsed.error.issues.map((e) => e.message).join("; "))}`,
    );
    return;
  }
  const { submissions } = getWriteContainer();
  const toCreate = parsed.data;
  if (toCreate == null) {
    return;
  }
  const r = await submissions.create(toCreate);
  if (!r.ok) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/submissions/new?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/dashboard/submissions");
  const { redirect } = await import("next/navigation");
  redirect("/dashboard/submissions");
}

export async function updateSubmissionFromValuesAction(
  submissionId: string,
  values: ItemSubmissionFormValues,
): Promise<ActionResult<{ redirectTo: string }>> {
  const id = submissionId.trim();
  if (!id) return actionFailure("Missing submission");
  const formParsed = itemSubmissionFormSchema.safeParse(values);
  if (!formParsed.success) {
    return actionFailure(
      firstZodErrorMessage(formParsed.error),
      zodErrorToFieldErrors(formParsed.error),
    );
  }
  const input = formValuesToUpdateItemSubmissionInput(formParsed.data);
  const apiParsed = updateItemSubmissionSchema.safeParse(input);
  if (!apiParsed.success) {
    return actionFailure(
      firstZodErrorMessage(apiParsed.error),
      zodErrorToFieldErrors(apiParsed.error),
    );
  }
  const patch = apiParsed.data;
  if (patch == null) {
    return actionFailure("Invalid update payload");
  }
  const { submissions } = getWriteContainer();
  const r = await submissions.update(id, patch);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/dashboard/submissions");
  revalidatePath(`/dashboard/submissions/${id}`);
  return actionSuccess({ redirectTo: `/dashboard/submissions/${id}` });
}

export async function updateSubmissionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("submissionId") ?? "").trim();
  if (!id) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/submissions?error=${encodeURIComponent("Missing submission")}`);
  }
  const input = parseFormDataToUpdateInput(formData);
  const parsed = updateItemSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    const { redirect } = await import("next/navigation");
    redirect(
      `/dashboard/submissions/${id}?error=${encodeURIComponent(parsed.error.issues.map((e) => e.message).join("; "))}`,
    );
    return;
  }
  const { submissions } = getWriteContainer();
  const patch = parsed.data;
  if (patch == null) {
    return;
  }
  const r = await submissions.update(id, patch);
  if (!r.ok) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/submissions/${id}?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/dashboard/submissions");
  revalidatePath(`/dashboard/submissions/${id}`);
  const { redirect } = await import("next/navigation");
  redirect(`/dashboard/submissions/${id}`);
}

export async function submitForReviewFromValuesAction(
  submissionId: string,
): Promise<ActionResult<void>> {
  const id = submissionId.trim();
  if (!id) return actionFailure("Missing submission");
  const { submissions } = getWriteContainer();
  const r = await submissions.submitForReview(id);
  const mapped = mapServiceToActionVoid(r);
  if (mapped.ok) {
    revalidatePath("/dashboard/submissions");
    revalidatePath(`/dashboard/submissions/${id}`);
  }
  return mapped;
}

export async function withdrawSubmissionFromValuesAction(
  submissionId: string,
): Promise<ActionResult<void>> {
  const id = submissionId.trim();
  if (!id) return actionFailure("Missing submission");
  const { submissions } = getWriteContainer();
  const r = await submissions.withdraw(id);
  const mapped = mapServiceToActionVoid(r);
  if (mapped.ok) {
    revalidatePath("/dashboard/submissions");
    revalidatePath(`/dashboard/submissions/${id}`);
  }
  return mapped;
}

export async function submitForReviewAction(formData: FormData): Promise<void> {
  const id = String(formData.get("submissionId") ?? "").trim();
  if (!id) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/submissions?error=${encodeURIComponent("Missing submission")}`);
  }
  const { submissions } = getWriteContainer();
  const r = await submissions.submitForReview(id);
  if (!r.ok) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/submissions/${id}?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/dashboard/submissions");
  revalidatePath(`/dashboard/submissions/${id}`);
  const { redirect } = await import("next/navigation");
  redirect(`/dashboard/submissions/${id}`);
}

export async function withdrawSubmissionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("submissionId") ?? "").trim();
  if (!id) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/submissions?error=${encodeURIComponent("Missing submission")}`);
  }
  const { submissions } = getWriteContainer();
  const r = await submissions.withdraw(id);
  if (!r.ok) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/submissions/${id}?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/dashboard/submissions");
  revalidatePath(`/dashboard/submissions/${id}`);
  const { redirect } = await import("next/navigation");
  redirect(`/dashboard/submissions/${id}`);
}
