"use client";

import { catalogWizardStepValidationBanner } from "@/lib/admin/catalog-form-step-copy";
import {
  SALE_SETUP_SALE_STEP_FIELDS,
  SALE_SETUP_STEPS,
  type SaleSetupStepId,
  saleSetupStepId,
} from "@/lib/admin/sale-setup";
import { zodIssuePathForForm as zodPathJoin } from "@/lib/admin/zod-form-errors";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { type RefObject, useCallback } from "react";

export const SALE_SETUP_STEP_FIELD_GROUPS: (keyof AdminSaleFormValues)[][] = [
  [...SALE_SETUP_SALE_STEP_FIELDS.identity],
  [...SALE_SETUP_SALE_STEP_FIELDS.schedule],
  [...SALE_SETUP_SALE_STEP_FIELDS.documents],
];

export function saleSetupZodIssuePath(path: (string | number)[]): string {
  if (path.length > 0 && typeof path[0] === "number") {
    return zodPathJoin(["buyerPremiumTiers", ...path]);
  }
  return zodPathJoin(path);
}

export function saleSetupStepLabel(stepIndex: number): string {
  const step = SALE_SETUP_STEPS[stepIndex];
  return step?.label ?? "this step";
}

export function saleSetupWizardValidationMessage(stepIndex: number | null): string {
  if (stepIndex == null) return catalogWizardStepValidationBanner();
  return catalogWizardStepValidationBanner(saleSetupStepLabel(stepIndex));
}

export function useSaleSetupSteps(wizardGoToRef: RefObject<(index: number) => void>) {
  const jumpToSetupStep = useCallback(
    (stepId: SaleSetupStepId) => {
      const idx = SALE_SETUP_STEPS.findIndex((s) => s.id === stepId);
      if (idx >= 0) wizardGoToRef.current(idx);
    },
    [wizardGoToRef],
  );

  const jumpToStepIndex = useCallback(
    (stepIndex: number) => {
      wizardGoToRef.current(stepIndex);
    },
    [wizardGoToRef],
  );

  const resolveStepIndexFromWizard = useCallback((stepIndex: number) => stepIndex, []);

  return {
    jumpToSetupStep,
    jumpToStepIndex,
    resolveStepIndexFromWizard,
    stepIdAt: saleSetupStepId,
  };
}

export type UseSaleSetupStepsReturn = ReturnType<typeof useSaleSetupSteps>;
