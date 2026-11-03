import {
  ARTWORK_TITLE_MAX_LENGTH,
  type AdminOriginalPrints,
  EDITION_RUN_MAX_SIZE,
} from "@auction/shop-contracts";
import { SHOP_EDITION_COUNT } from "@auction/shop-domain";
import {
  type RunFormField,
  type RunFormValues,
  emptyRunForm,
  firstBatchInput,
  proofsKeptInput,
  runSpecInput,
  typedSize,
  validateRunForm,
} from "./edition-run-form";

/*
 * Prints made from an original: the run (LAX standard to start with) and the Shop title, which
 * follows the original's title until staff type their own. Used by the "Also create prints"
 * section of a new original and by "Create prints" on a saved one. Kept apart from the
 * components so the rules and wording are tested without rendering.
 */

export type OriginalPrintsFormValues = {
  /** The optional section of a new original; always on in the "Create prints" dialog. */
  enabled: boolean;
  /** The title staff typed; null while the prints keep the original's title. */
  titleOverride: string | null;
  run: RunFormValues;
};

export type OriginalPrintsField = "title" | RunFormField;

/** Buyers of the original are known, because the prints are made from it. */
const LINKED_TO_ORIGINAL = { linkedToOriginal: true } as const;

export function originalPrintsFieldId(field: "title"): string {
  return `original-prints-${field}`;
}

export function emptyOriginalPrintsForm(enabled = false): OriginalPrintsFormValues {
  return { enabled, titleOverride: null, run: emptyRunForm() };
}

/** The Shop title: the one typed, or the original's own. */
export function originalPrintsTitle(
  values: OriginalPrintsFormValues,
  originalTitle: string,
): string {
  return (values.titleOverride ?? originalTitle).trim();
}

export function validateOriginalPrintsForm(
  values: OriginalPrintsFormValues,
  originalTitle: string,
): Partial<Record<OriginalPrintsField, string>> {
  const errors: Partial<Record<OriginalPrintsField, string>> = {};
  const title = originalPrintsTitle(values, originalTitle);
  if (!title) errors.title = "Enter a title for the prints";
  else if (title.length > ARTWORK_TITLE_MAX_LENGTH) {
    errors.title = `Keep the title to ${ARTWORK_TITLE_MAX_LENGTH} characters or fewer`;
  }
  return { ...errors, ...validateRunForm(values.run, LINKED_TO_ORIGINAL) };
}

/** The errors in page order with the id each control renders, for `FormErrorSummary`. */
export function originalPrintsErrorSummary(
  errors: Partial<Record<OriginalPrintsField, string>>,
  runSummary: ReadonlyArray<{ fieldId: string; message: string }>,
) {
  return [
    ...(errors.title ? [{ fieldId: originalPrintsFieldId("title"), message: errors.title }] : []),
    ...runSummary,
  ];
}

/** The prints as the API takes them. Call only once `validateOriginalPrintsForm` finds nothing. */
export function originalPrintsBody(
  values: OriginalPrintsFormValues,
  originalTitle: string,
): AdminOriginalPrints {
  const firstBatch = firstBatchInput(values.run);
  return {
    title: originalPrintsTitle(values, originalTitle),
    run: {
      spec: runSpecInput(values.run),
      proofsKept: proofsKeptInput(values.run),
      ...(firstBatch ? { firstBatch } : {}),
    },
  };
}

/** How many prints the run will create, or null while the run is not valid. */
export function originalPrintsCount(values: OriginalPrintsFormValues): number | null {
  const { run } = values;
  if (Object.keys(validateRunForm(run, LINKED_TO_ORIGINAL)).length > 0) return null;
  switch (run.template) {
    case "lax_standard":
      return SHOP_EDITION_COUNT;
    case "custom_limited": {
      const size = typedSize(run);
      return size !== null && size <= EDITION_RUN_MAX_SIZE ? size : null;
    }
    case "open": {
      const batch = firstBatchInput(run);
      return batch ? batch.artistCount + batch.laxCount : 0;
    }
  }
}

function printsPhrase(count: number | null): string {
  if (count === null || count === 0) return "prints";
  return count === 1 ? "1 print" : `${count} prints`;
}

/** "Create original and 24 prints"; "Create original and prints" while the number is not known. */
export function createOriginalAndPrintsLabel(count: number | null): string {
  return `Create original and ${printsPhrase(count)}`;
}

/** "Create 24 prints" for the dialog on a saved original. */
export function createPrintsLabel(count: number | null): string {
  return `Create ${printsPhrase(count)}`;
}
