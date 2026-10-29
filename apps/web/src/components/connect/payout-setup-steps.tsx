import type { PayoutSetupStep } from "@/lib/presenters/payout-setup-steps";
import { cn } from "@auction/ui";
import { Check } from "lucide-react";

/** The plain steps to set up payouts, numbered, with a tick on the ones already done. */
export function PayoutSetupSteps({ steps }: { steps: readonly PayoutSetupStep[] }) {
  return (
    <ol aria-label="Steps to set up payouts" className="space-y-2">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full font-body text-xs font-semibold",
              step.done
                ? "bg-success-container text-on-success-container"
                : "bg-surface-container-high text-on-surface",
            )}
          >
            {step.done ? <Check className="size-3.5" strokeWidth={2.5} /> : index + 1}
          </span>
          <span className="font-body text-sm text-on-surface">
            {step.label}
            {step.done ? <span className="sr-only"> (done)</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
