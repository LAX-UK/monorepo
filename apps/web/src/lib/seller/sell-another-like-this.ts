import { EMPTY_SUBMISSION_FORM_VALUES } from "@/lib/forms/submission/item-submission-form-defaults";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { ItemSubmission } from "@auction/types";
import type { ItemSubmissionFormValues } from "@auction/validators";

export const SELL_ANOTHER_LIKE_THIS_LABEL = "Sell another like this";

/**
 * The answers "Sell another like this" carries from one work to the next: the facts a series or
 * a body of work shares. Title, photos, size, prices, condition and notes differ per work and
 * are never copied. A submission has no artist field of its own yet (the client names the artist in
 * the title or description, and the specialist links the artist when it becomes a lot), so there
 * is no artist answer to carry; add it here when the wizard asks for one.
 */
export const COPIED_FIELDS = [
  "categoryIds",
  "medium",
  "edition",
  "isSigned",
  "provenance",
] as const satisfies readonly (keyof ItemSubmissionFormValues)[];

/** Where "Sell another like this" goes for a submission. */
export function sellAnotherLikeThisHref(submissionId: string): string {
  return `${CLIENT_ROUTES.sellingNew}?copyFrom=${encodeURIComponent(submissionId)}`;
}

/** A blank wizard with only the shared facts of `source` filled in. */
export function copyFromValues(source: ItemSubmission): ItemSubmissionFormValues {
  const categoryIds = source.categoryIds?.length
    ? [...source.categoryIds]
    : source.categoryId
      ? [source.categoryId]
      : [];
  return {
    ...EMPTY_SUBMISSION_FORM_VALUES,
    categoryIds,
    medium: source.medium ?? "",
    edition: source.edition ?? "",
    isSigned: source.isSigned ?? false,
    provenance: (source.provenance ?? []).map((entry) => ({ ...entry })),
  };
}

/** The notice at the top of a wizard started from another work. */
export function startedFromNotice(title: string): { title: string; detail: string } {
  return { title: `Started from ${title}.`, detail: "Check every step before you send it." };
}

export type CopyFromResult =
  | { kind: "none" }
  | { kind: "found"; values: ItemSubmissionFormValues; sourceTitle: string }
  | { kind: "not-found" };

/**
 * Reads the work a "Sell another like this" link names. A link is only an address: the read
 * goes through the same rule as viewing that consignment (the API answers 404 for a submission
 * that is not the signed-in client's or their organisation's), and anything that cannot be read
 * is not found, never a blank form that looks copied.
 */
export async function loadCopyFrom(
  copyFrom: string | undefined,
  readMine: (id: string) => Promise<ItemSubmission | null>,
): Promise<CopyFromResult> {
  const id = typeof copyFrom === "string" ? copyFrom.trim() : "";
  if (!id) return { kind: "none" };
  const source = await readMine(id).catch(() => null);
  if (!source) return { kind: "not-found" };
  return { kind: "found", values: copyFromValues(source), sourceTitle: source.title };
}
