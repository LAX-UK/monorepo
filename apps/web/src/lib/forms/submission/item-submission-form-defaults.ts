import type { CategoryNode, ItemSubmission } from "@auction/types";
import type { NewSubmissionFormValues } from "./submission-form-schema";

export type SubmissionCategoryOption = CategoryNode;

export function itemSubmissionToFormValues(s: ItemSubmission): NewSubmissionFormValues {
  return {
    title: s.title,
    description: s.description ?? "",
    medium: s.medium ?? "",
    dimensions: s.dimensions ?? "",
    categoryIds: s.categoryIds?.length ? s.categoryIds : [s.categoryId],
    images: s.images,
    yearOfWork: s.yearOfWork ?? "",
    isSigned: s.isSigned ?? false,
    signatureNote: s.signatureNote ?? "",
    edition: s.edition ?? "",
    conditionSelfReport: s.conditionSelfReport ?? "",
    provenance: s.provenance ?? [],
    exhibitions: s.exhibitions ?? [],
    askingPrice: s.askingPrice ?? "",
    reservePrice: s.reservePrice ?? "",
    submitterNotes: s.submitterNotes ?? "",
  };
}
