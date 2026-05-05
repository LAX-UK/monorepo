import type { ItemSubmissionFormValues } from "@auction/validators";

export function formValuesToCreateItemSubmissionInput(values: ItemSubmissionFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    medium: values.medium.trim() || undefined,
    dimensions: values.dimensions.trim() || undefined,
    images: values.images.length > 0 ? values.images : undefined,
    yearOfWork: values.yearOfWork.trim() || undefined,
    isSigned: values.isSigned,
    signatureNote: values.signatureNote.trim() || undefined,
    edition: values.edition.trim() || undefined,
    conditionSelfReport: values.conditionSelfReport.trim() || undefined,
    provenance: values.provenance.length > 0 ? values.provenance : undefined,
    exhibitions: values.exhibitions.length > 0 ? values.exhibitions : undefined,
    askingPrice: values.askingPrice.trim() || undefined,
    reservePrice: values.reservePrice.trim() || undefined,
    categoryIds: values.categoryIds,
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
    yearOfWork: base.yearOfWork,
    isSigned: base.isSigned,
    signatureNote: base.signatureNote,
    edition: base.edition,
    conditionSelfReport: base.conditionSelfReport,
    provenance: base.provenance,
    exhibitions: base.exhibitions,
    askingPrice: base.askingPrice,
    reservePrice: base.reservePrice,
    categoryIds: base.categoryIds,
    submitterNotes: base.submitterNotes,
  };
}

export function createSubmissionFormData(values: ItemSubmissionFormValues): FormData {
  const fd = new FormData();
  fd.set("title", values.title.trim());
  fd.set("description", values.description.trim());
  fd.set("medium", values.medium.trim());
  fd.set("dimensions", values.dimensions.trim());
  fd.set("categoryIds", values.categoryIds.join(","));
  fd.set("images", values.images.join("\n"));
  fd.set("yearOfWork", values.yearOfWork.trim());
  fd.set("isSigned", values.isSigned ? "true" : "false");
  fd.set("signatureNote", values.signatureNote.trim());
  fd.set("edition", values.edition.trim());
  fd.set("conditionSelfReport", values.conditionSelfReport.trim());
  fd.set("provenance", JSON.stringify(values.provenance));
  fd.set("exhibitions", JSON.stringify(values.exhibitions));
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
