import { cn } from "@auction/ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type MarketingProcessStep = {
  id: string;
  title: string;
  description: ReactNode;
  /** Optional step icon — when omitted, badge renders number only (backward-compatible). */
  icon?: LucideIcon;
};

type MarketingProcessStepsProps = {
  steps: readonly MarketingProcessStep[];
  className?: string;
};

/** Scannable numbered steps for buy/sell conversion pages. */
export function MarketingProcessSteps({ steps, className }: MarketingProcessStepsProps) {
  return (
    <ol className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <li
            key={step.id}
            className="flex flex-col gap-3 rounded-lg border border-border-hairline bg-surface-container-lowest p-5"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex shrink-0 flex-col items-center justify-center rounded-full bg-surface-container-low font-label font-semibold text-secondary tabular-nums",
                  Icon ? "size-10 gap-0.5 py-1" : "size-8 text-sm",
                )}
                aria-hidden
              >
                {Icon ? <Icon className="size-3.5 shrink-0" strokeWidth={2} /> : null}
                <span className={Icon ? "text-[10px] leading-none" : undefined}>{index + 1}</span>
              </span>
              <h3 className="pt-0.5 font-headline text-base font-medium text-on-surface">
                {step.title}
              </h3>
            </div>
            <div className="font-body text-sm leading-relaxed text-on-surface-variant">
              {step.description}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
