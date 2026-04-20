import type { NewSubmissionFormValues } from "./submission-form-schema";

export function createSubmissionFormData(values: NewSubmissionFormValues): FormData {
  const fd = new FormData();
  fd.set("title", values.title.trim());
  fd.set("description", values.description.trim());
  fd.set("medium", values.medium.trim());
  fd.set("dimensions", values.dimensions.trim());
  fd.set("categoryId", values.categoryId);
  fd.set("images", values.imagesText);
  fd.set("askingPrice", values.askingPrice.trim());
  fd.set("reservePrice", values.reservePrice.trim());
  fd.set("submitterNotes", values.submitterNotes.trim());
  return fd;
}

export function updateSubmissionFormData(
  submissionId: string,
  values: NewSubmissionFormValues,
): FormData {
  const fd = createSubmissionFormData(values);
  fd.set("submissionId", submissionId);
  return fd;
}
