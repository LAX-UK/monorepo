import { describe, expect, it } from "vitest";
import { catalogPrepReviewNotice } from "./field-copy";
import {
  type ResolveSaleSetupStepTransitionInput,
  resolveSaleSetupStepTransition,
} from "./resolve-sale-setup-step-transition";

const SALE_ID = "10000000-0000-4000-8000-000000000001";

function baseInput(
  overrides: Partial<ResolveSaleSetupStepTransitionInput> = {},
): ResolveSaleSetupStepTransitionInput {
  return {
    stepIndex: 0,
    stepId: "identity",
    readOnlySaleSteps: false,
    readOnlyLots: false,
    saleId: SALE_ID,
    lotsUnsaved: false,
    lotsCount: 1,
    catalogPrepShowReadinessNotice: false,
    catalogPrepHref: `/admin/sales/${SALE_ID}/setup?step=catalog-prep`,
    reviewHref: `/admin/sales/${SALE_ID}/setup?step=review`,
    ...overrides,
  };
}

describe("resolveSaleSetupStepTransition", () => {
  it("readonly sale steps skip early steps until lots", () => {
    expect(
      resolveSaleSetupStepTransition(baseInput({ stepIndex: 0, readOnlySaleSteps: true })),
    ).toEqual({
      action: "readonly-skip",
      allowWhenStepIndexGte: 3,
    });
    expect(
      resolveSaleSetupStepTransition(
        baseInput({ stepIndex: 2, stepId: "documents", readOnlySaleSteps: true }),
      ),
    ).toEqual({
      action: "readonly-skip",
      allowWhenStepIndexGte: 3,
    });
  });

  it("schedule and documents steps persist before advancing", () => {
    expect(resolveSaleSetupStepTransition(baseInput({ stepIndex: 1, stepId: "schedule" }))).toEqual(
      {
        action: "persist",
        savedNoticeStep: "documents",
        nextStep: "documents",
      },
    );
    expect(
      resolveSaleSetupStepTransition(baseInput({ stepIndex: 2, stepId: "documents" })),
    ).toEqual({
      action: "persist",
      savedNoticeStep: "lots",
      nextStep: "lots",
    });
  });

  it("identity step advances after validation in executor", () => {
    expect(resolveSaleSetupStepTransition(baseInput({ stepIndex: 0, stepId: "identity" }))).toEqual(
      {
        action: "advance",
      },
    );
  });

  it("lots step blocks without sale id, unsaved lots, or zero lots", () => {
    expect(
      resolveSaleSetupStepTransition(baseInput({ stepIndex: 3, stepId: "lots", saleId: null })),
    ).toEqual({ action: "block", notifyMessage: "Save the sale first" });

    expect(
      resolveSaleSetupStepTransition(
        baseInput({ stepIndex: 3, stepId: "lots", lotsUnsaved: true }),
      ),
    ).toEqual({ action: "block", notifyMessage: "Save all lots before continuing" });

    expect(
      resolveSaleSetupStepTransition(baseInput({ stepIndex: 3, stepId: "lots", lotsCount: 0 })),
    ).toEqual({ action: "block", notifyMessage: "Add at least one lot" });
  });

  it("lots step advances for read-only and navigates when ready", () => {
    expect(
      resolveSaleSetupStepTransition(
        baseInput({ stepIndex: 3, stepId: "lots", readOnlyLots: true }),
      ),
    ).toEqual({ action: "advance" });

    expect(resolveSaleSetupStepTransition(baseInput({ stepIndex: 3, stepId: "lots" }))).toEqual({
      action: "navigate",
      href: `/admin/sales/${SALE_ID}/setup?step=catalog-prep`,
    });
  });

  it("catalog-prep navigates to review with optional readiness notice", () => {
    expect(
      resolveSaleSetupStepTransition(baseInput({ stepIndex: 4, stepId: "catalog-prep" })),
    ).toEqual({
      action: "navigate",
      href: `/admin/sales/${SALE_ID}/setup?step=review`,
    });

    expect(
      resolveSaleSetupStepTransition(
        baseInput({
          stepIndex: 4,
          stepId: "catalog-prep",
          catalogPrepShowReadinessNotice: true,
        }),
      ),
    ).toEqual({
      action: "navigate",
      href: `/admin/sales/${SALE_ID}/setup?step=review`,
      notice: catalogPrepReviewNotice(),
    });
  });

  it("review step advances", () => {
    expect(resolveSaleSetupStepTransition(baseInput({ stepIndex: 5, stepId: "review" }))).toEqual({
      action: "advance",
    });
  });
});
