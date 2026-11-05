import { describe, expect, it } from "vitest";
import { EMPTY_SUBMISSION_FORM_VALUES } from "./item-submission-form-defaults";
import { SELL_FORM_ERRORS, photoTooLargeMessage } from "./sell-form-copy";
import {
  collectStepErrors,
  sellFieldControlId,
  sellFieldItemId,
  stepUsesSummary,
} from "./step-errors";
import { WIZARD_STEPS, type WizardStepId } from "./step-validation";

function step(id: WizardStepId) {
  const found = WIZARD_STEPS.find((s) => s.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
}

const CATEGORY = "11111111-1111-4111-8111-111111111111";

describe("collectStepErrors", () => {
  it("asks for the title and a category on the first step, in field order", () => {
    expect(collectStepErrors(step("basics"), EMPTY_SUBMISSION_FORM_VALUES)).toEqual([
      { field: "title", message: "Enter the title of the work" },
      { field: "categoryIds", message: "Choose a category" },
    ]);
  });

  it("treats a title of spaces as missing", () => {
    const values = { ...EMPTY_SUBMISSION_FORM_VALUES, title: "   ", categoryIds: [CATEGORY] };
    expect(collectStepErrors(step("basics"), values)).toEqual([
      { field: "title", message: SELL_FORM_ERRORS.title },
    ]);
  });

  it("has nothing to say about a complete first step", () => {
    const values = { ...EMPTY_SUBMISSION_FORM_VALUES, title: "Blue", categoryIds: [CATEGORY] };
    expect(collectStepErrors(step("basics"), values)).toEqual([]);
  });

  it("asks for at least one photo, once", () => {
    expect(collectStepErrors(step("photos"), EMPTY_SUBMISSION_FORM_VALUES)).toEqual([
      { field: "images", message: "Add at least one photo" },
    ]);
    expect(
      collectStepErrors(step("photos"), { ...EMPTY_SUBMISSION_FORM_VALUES, images: ["a.jpg"] }),
    ).toEqual([]);
  });

  it("accepts an empty, whole or two-decimal price and refuses anything else", () => {
    for (const ok of ["", "2500", "2500.5", "2500.50"]) {
      expect(
        collectStepErrors(step("pricing"), { ...EMPTY_SUBMISSION_FORM_VALUES, askingPrice: ok }),
      ).toEqual([]);
    }
    expect(
      collectStepErrors(step("pricing"), {
        ...EMPTY_SUBMISSION_FORM_VALUES,
        askingPrice: "2,5x",
        reservePrice: "abc",
      }),
    ).toEqual([
      { field: "askingPrice", message: "Enter a price in pounds, like 2,500" },
      { field: "reservePrice", message: "Enter a price in pounds, like 2,500" },
    ]);
  });

  it("checks only the fields its step owns", () => {
    expect(collectStepErrors(step("details"), EMPTY_SUBMISSION_FORM_VALUES)).toEqual([]);
    expect(collectStepErrors(step("review"), EMPTY_SUBMISSION_FORM_VALUES)).toEqual([]);
  });
});

describe("stepUsesSummary", () => {
  it("lists problems at the top of every step with more than one field", () => {
    expect(stepUsesSummary(step("basics"))).toBe(true);
    expect(stepUsesSummary(step("pricing"))).toBe(true);
  });

  it("leaves the photo step, which is one control, to say it under the control", () => {
    expect(stepUsesSummary(step("photos"))).toBe(false);
  });
});

describe("control ids", () => {
  it("names the control the summary links to after its form item", () => {
    expect(sellFieldItemId("title")).toBe("sell-field-title");
    expect(sellFieldControlId("title")).toBe("sell-field-title-form-item");
  });
});

describe("photo copy", () => {
  it("names the limit in whole megabytes", () => {
    expect(photoTooLargeMessage(10 * 1024 * 1024)).toBe(
      "This photo is over 10 MB. Choose a smaller file",
    );
  });
});
