import type { ItemSubmissionFormValues } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { EMPTY_SUBMISSION_FORM_VALUES } from "./item-submission-form-defaults";
import {
  WIZARD_STEPS,
  allWizardFieldPaths,
  firstIncompleteWizardStepIndex,
  wizardStepIndex,
} from "./step-validation";

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

  it("firstIncompleteWizardStepIndex opens basics when title or category missing", () => {
    expect(
      firstIncompleteWizardStepIndex({
        ...EMPTY_SUBMISSION_FORM_VALUES,
        title: "",
        categoryIds: [],
        images: [],
      }),
    ).toBe(wizardStepIndex("basics"));
  });

  it("firstIncompleteWizardStepIndex opens photos when images missing", () => {
    expect(
      firstIncompleteWizardStepIndex({
        ...EMPTY_SUBMISSION_FORM_VALUES,
        title: "Study",
        categoryIds: ["cat-1"],
        images: [],
      }),
    ).toBe(wizardStepIndex("photos"));
  });

  it("firstIncompleteWizardStepIndex opens review when required fields are complete", () => {
    expect(
      firstIncompleteWizardStepIndex({
        ...EMPTY_SUBMISSION_FORM_VALUES,
        title: "Study",
        categoryIds: ["cat-1"],
        images: ["https://example.com/a.jpg"],
      }),
    ).toBe(wizardStepIndex("review"));
  });
});
