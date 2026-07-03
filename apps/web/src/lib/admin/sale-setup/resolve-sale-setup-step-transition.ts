import { catalogPrepReviewNotice } from "./field-copy";
import type { SaleSetupStepId } from "./steps";

export type SaleSetupStepTransitionResult =
  | { action: "readonly-skip"; allowWhenStepIndexGte: number }
  | { action: "block"; notifyMessage?: string }
  | {
      action: "persist";
      savedNoticeStep: SaleSetupStepId;
      nextStep: SaleSetupStepId;
    }
  | { action: "navigate"; href: string; notice?: string }
  | { action: "advance" };

export type ResolveSaleSetupStepTransitionInput = {
  stepIndex: number;
  stepId: SaleSetupStepId;
  readOnlySaleSteps: boolean;
  readOnlyLots: boolean;
  saleId: string | null;
  lotsUnsaved: boolean;
  lotsCount: number;
  catalogPrepShowReadinessNotice: boolean;
  catalogPrepHref: string;
  reviewHref: string;
};

export function resolveSaleSetupStepTransition(
  input: ResolveSaleSetupStepTransitionInput,
): SaleSetupStepTransitionResult {
  const {
    stepIndex,
    stepId,
    readOnlySaleSteps,
    readOnlyLots,
    saleId,
    lotsUnsaved,
    lotsCount,
    catalogPrepShowReadinessNotice,
    catalogPrepHref,
    reviewHref,
  } = input;

  if (stepIndex <= 2) {
    if (readOnlySaleSteps) {
      return { action: "readonly-skip", allowWhenStepIndexGte: 3 };
    }
    if (stepIndex === 1) {
      return { action: "persist", savedNoticeStep: "documents", nextStep: "documents" };
    }
    if (stepIndex === 2) {
      return { action: "persist", savedNoticeStep: "lots", nextStep: "lots" };
    }
    return { action: "advance" };
  }

  if (stepId === "lots") {
    if (readOnlyLots) return { action: "advance" };
    if (!saleId) return { action: "block", notifyMessage: "Save the sale first" };
    if (lotsUnsaved) return { action: "block", notifyMessage: "Save all lots before continuing" };
    if (lotsCount === 0) return { action: "block", notifyMessage: "Add at least one lot" };
    return { action: "navigate", href: catalogPrepHref };
  }

  if (stepId === "catalog-prep") {
    return {
      action: "navigate",
      href: reviewHref,
      ...(catalogPrepShowReadinessNotice ? { notice: catalogPrepReviewNotice() } : {}),
    };
  }

  return { action: "advance" };
}
