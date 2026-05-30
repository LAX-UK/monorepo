"use client";

import { WizardStepIntro } from "@/components/admin/admin-form-wizard/wizard-step-intro";
import type { SaleSetupStepId } from "@/lib/admin/sale-setup";
import { stepIntro } from "@/lib/admin/sale-setup";

type Props = {
  stepId: SaleSetupStepId;
  stepIndex: number;
  stepCount?: number;
};

export function SaleSetupStepIntro({ stepId, stepIndex, stepCount = 6 }: Props) {
  const intro = stepIntro(stepId);
  const nextStepIds: SaleSetupStepId[] = [
    "identity",
    "schedule",
    "documents",
    "lots",
    "catalog-prep",
    "review",
  ];
  const nextId = nextStepIds[stepIndex + 1];
  const nextHint = nextId ? stepIntro(nextId).title : undefined;

  return (
    <WizardStepIntro
      stepIndex={stepIndex}
      stepCount={stepCount}
      copy={{
        title: intro.title,
        body: intro.body,
        ...(nextHint ? { nextHint } : {}),
      }}
    />
  );
}
