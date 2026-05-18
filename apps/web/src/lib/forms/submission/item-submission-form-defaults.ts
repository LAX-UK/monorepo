import type { CategoryNode, ItemSubmission } from "@auction/types";
import type { ItemSubmissionFormValues as NewSubmissionFormValues } from "@auction/validators";

export type SubmissionCategoryOption = CategoryNode;

export const EMPTY_SUBMISSION_FORM_VALUES: NewSubmissionFormValues = {
  title: "",
  description: "",
  medium: "",
  dimensions: "",
  categoryIds: [],
  images: [],
  yearOfWork: "",
  isSigned: false,
  signatureNote: "",
  edition: "",
  conditionSelfReport: "",
  provenance: [],
  exhibitions: [],
  askingPrice: "",
  reservePrice: "",
  submitterNotes: "",
};

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
