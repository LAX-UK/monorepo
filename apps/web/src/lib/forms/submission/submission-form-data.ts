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
