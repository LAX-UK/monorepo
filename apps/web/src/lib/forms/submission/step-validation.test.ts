import type { ItemSubmissionFormValues } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { WIZARD_STEPS, allWizardFieldPaths } from "./step-validation";

const FORM_FIELD_KEYS = [
  "title",
  "description",
  "medium",
  "dimensions",
  "categoryIds",
  "images",
  "yearOfWork",
  "isSigned",
  "signatureNote",
  "edition",
  "conditionSelfReport",
  "provenance",
  "exhibitions",
  "askingPrice",
  "reservePrice",
  "submitterNotes",
] as const satisfies readonly (keyof ItemSubmissionFormValues)[];

describe("step-validation", () => {
  it("assigns every itemSubmissionFormValues field to exactly one wizard step", () => {
    const schemaKeys = new Set<string>(FORM_FIELD_KEYS);
    const wizardKeys = new Set(allWizardFieldPaths());

    expect(wizardKeys).toEqual(schemaKeys);
    for (const step of WIZARD_STEPS) {
      if (step.id === "review") {
        expect(step.fields).toHaveLength(0);
      }
    }
  });
});
