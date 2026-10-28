import { cn } from "@auction/ui";

type Props = {
  steps: readonly string[];
  /** Zero-based. */
  current: number;
  className?: string;
};

/**
 * "Step 1 of 2 · The work" with one bar per step. The bars are decoration; the sentence is what
 * assistive technology reads.
 */
export function FlowStepIndicator({ steps, current, className }: Props) {
  return (
    <div className={cn("space-y-2 pt-2 sm:pt-4", className)}>
      <div className="flex gap-2" aria-hidden>
        {steps.map((label, index) => (
          <span
            key={label}
            className={cn(
              "h-1 flex-1 rounded-full",
              index <= current ? "bg-primary" : "bg-outline-variant/40",
            )}
          />
        ))}
      </div>
      <p className="font-body text-xs text-on-surface-variant" aria-live="polite">
        Step {current + 1} of {steps.length} · {steps[current]}
      </p>
    </div>
  );
}
