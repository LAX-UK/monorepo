/** Shared validation copy for catalog entity forms (lot, sale, sale setup). */

export function catalogFormValidationBanner(count: number, locationLabel?: string): string {
  if (count <= 1) {
    return locationLabel
      ? `Fix the highlighted field on ${locationLabel} before saving.`
      : "Fix the highlighted field before saving.";
  }
  return locationLabel
    ? `Fix ${count} highlighted fields on ${locationLabel} before saving.`
    : `Fix ${count} highlighted fields before saving.`;
}

export function catalogWizardStepValidationBanner(locationLabel?: string): string {
  return locationLabel
    ? `Fix the highlighted fields on ${locationLabel} before continuing.`
    : "Fix the highlighted fields on this step before continuing.";
}
