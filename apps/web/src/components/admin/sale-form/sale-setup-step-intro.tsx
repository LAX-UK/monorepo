"use client";

import type { SaleSetupStepId } from "@/lib/admin/sale-setup";
import { stepIntro } from "@/lib/admin/sale-setup";

type Props = {
  stepId: SaleSetupStepId;
  stepIndex: number;
  stepCount?: number;
};

export function SaleSetupStepIntro({ stepId, stepIndex, stepCount = 6 }: Props) {
  const { title, body } = stepIntro(stepId);
  return (
    <div className="space-y-2">
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Step {stepIndex + 1} of {stepCount}
      </p>
      <h2 className="font-headline text-xl text-on-surface">{title}</h2>
      <p className="font-body text-sm text-on-surface-variant">{body}</p>
    </div>
  );
}
