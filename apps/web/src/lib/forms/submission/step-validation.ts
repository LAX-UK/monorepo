import type { ItemSubmissionFormValues } from "@auction/validators";
import type { FieldPath } from "react-hook-form";

export type WizardStepId = "basics" | "details" | "photos" | "provenance" | "pricing" | "review";

export type WizardStepDefinition = {
  id: WizardStepId;
  label: string;
  fields: readonly FieldPath<ItemSubmissionFormValues>[];
};

export const WIZARD_STEPS: readonly WizardStepDefinition[] = [
  {
    id: "basics",
    label: "Basics",
    fields: ["title", "categoryIds", "yearOfWork", "edition"],
  },
  {
    id: "details",
    label: "Details",
    fields: ["medium", "dimensions", "isSigned", "signatureNote", "description"],
  },
  {
    id: "photos",
    label: "Photos",
    fields: ["images"],
  },
  {
    id: "provenance",
    label: "Provenance",
    fields: ["provenance", "exhibitions"],
  },
  {
    id: "pricing",
    label: "Pricing",
    fields: ["askingPrice", "reservePrice", "conditionSelfReport", "submitterNotes"],
  },
  {
    id: "review",
    label: "Review",
    fields: [],
  },
] as const;

export const WIZARD_STEP_COUNT = WIZARD_STEPS.length;

export function wizardStepIndex(id: WizardStepId): number {
  const idx = WIZARD_STEPS.findIndex((s) => s.id === id);
  return idx >= 0 ? idx : 0;
}

/** All form fields assigned to a wizard step (excludes review). */
export function allWizardFieldPaths(): FieldPath<ItemSubmissionFormValues>[] {
  return WIZARD_STEPS.flatMap((s) => [...s.fields]);
}
