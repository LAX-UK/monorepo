import type { ItemSubmissionFormValues } from "@auction/validators";

/** Drop incomplete provenance / exhibition rows before Zod parse or API mapping. */
export function sanitizeSubmissionFormValues(
  values: ItemSubmissionFormValues,
): ItemSubmissionFormValues {
  return {
    ...values,
    provenance: cleanProvenance(values),
    exhibitions: cleanExhibitions(values),
  };
}

function cleanProvenance(values: ItemSubmissionFormValues) {
  return values.provenance
    .map((e) => ({
      ...(e.period?.trim() ? { period: e.period.trim() } : {}),
      note: e.note.trim(),
    }))
    .filter((e) => e.note.length > 0);
}

function cleanExhibitions(values: ItemSubmissionFormValues) {
  return values.exhibitions
    .map((e) => ({
      ...(e.year?.trim() ? { year: e.year.trim() } : {}),
      venue: e.venue.trim(),
      ...(e.note?.trim() ? { note: e.note.trim() } : {}),
    }))
    .filter((e) => e.venue.length > 0);
}

export function formValuesToCreateItemSubmissionInput(values: ItemSubmissionFormValues) {
  const provenance = cleanProvenance(values);
  const exhibitions = cleanExhibitions(values);
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
    provenance: provenance.length > 0 ? provenance : undefined,
    exhibitions: exhibitions.length > 0 ? exhibitions : undefined,
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
