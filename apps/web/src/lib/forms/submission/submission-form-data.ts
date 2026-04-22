import { splitSubmissionUrlLines } from "@auction/validators";
import type { ItemSubmissionFormValues } from "@auction/validators";

export function formValuesToCreateItemSubmissionInput(values: ItemSubmissionFormValues) {
  const imagesRaw = splitSubmissionUrlLines(values.imagesText);
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    medium: values.medium.trim() || undefined,
    dimensions: values.dimensions.trim() || undefined,
    images: imagesRaw.length > 0 ? imagesRaw : undefined,
    askingPrice: values.askingPrice.trim() || undefined,
    reservePrice: values.reservePrice.trim() || undefined,
    categoryId: values.categoryId,
    submitterNotes: values.submitterNotes.trim() || undefined,
  };
}

export function formValuesToUpdateItemSubmissionInput(values: ItemSubmissionFormValues) {
  const base = formValuesToCreateItemSubmissionInput(values);
  return {
    title: base.title || undefined,
    description: base.description,
    medium: base.medium,
    dimensions: base.dimensions,
    images: base.images,
    askingPrice: base.askingPrice,
    reservePrice: base.reservePrice,
    categoryId: base.categoryId,
    submitterNotes: base.submitterNotes,
  };
}

export function createSubmissionFormData(values: ItemSubmissionFormValues): FormData {
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
  values: ItemSubmissionFormValues,
): FormData {
  const fd = createSubmissionFormData(values);
  fd.set("submissionId", submissionId);
  return fd;
}
