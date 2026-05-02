import type { ItemSubmission } from "@auction/types";
import type { NewSubmissionFormValues } from "./submission-form-schema";

export type SubmissionCategoryOption = { id: string; name: string };

export function itemSubmissionToFormValues(s: ItemSubmission): NewSubmissionFormValues {
  return {
    title: s.title,
    description: s.description ?? "",
    medium: s.medium ?? "",
    dimensions: s.dimensions ?? "",
    categoryId: s.categoryId,
    images: s.images,
    askingPrice: s.askingPrice ?? "",
    reservePrice: s.reservePrice ?? "",
    submitterNotes: s.submitterNotes ?? "",
  };
}
