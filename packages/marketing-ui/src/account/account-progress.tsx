import { cn } from "@auction/ui";

export type AccountProgressStep = {
  id: string;
  label: string;
  /** A short date or deadline under the label ("24 Oct", "Due 7 Nov"). */
  date?: string | null;
  progress: "done" | "current" | "upcoming";
};

export type AccountProgressProps = {
  /** Names the tracker for assistive tech ("Purchase progress"). */
  label: string;
  steps: readonly AccountProgressStep[];
  className?: string;
};

/** Column classes by step count, so each step keeps its own column. */
const COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

const PROGRESS_TEXT: Record<AccountProgressStep["progress"], string> = {
  done: "done",
  current: "current step",
  upcoming: "not started",
};

/**
 * Where an order or purchase is on its way (won, payment, delivery, delivered): dots on one
 * line, solid up to the current step, which is ringed in the product accent. Each step keeps
 * its own column at every width, so the line never wraps.
 */
export function AccountProgress({ label, steps, className }: AccountProgressProps) {
  return (
    <ol aria-label={label} className={cn("grid", COLUMNS[steps.length], className)}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const lineDone = step.progress === "done" && steps[index + 1]?.progress !== "upcoming";
        return (
          <li
            key={step.id}
            aria-current={step.progress === "current" ? "step" : undefined}
            className="relative min-w-0 pr-2"
          >
            <div className="relative flex h-3.5 items-center" aria-hidden>
              {last ? null : (
                <span
                  className={cn(
                    "absolute top-1/2 right-0 left-3.5 h-0.5 -translate-y-1/2",
                    lineDone ? "bg-on-surface" : "bg-outline-variant",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative block size-3.5 shrink-0 rounded-full",
                  step.progress === "done" && "bg-on-surface",
                  step.progress === "current" &&
                    "border-2 border-[var(--color-product-accent,var(--color-on-surface))] bg-surface-container-lowest",
                  step.progress === "upcoming" &&
                    "border-[1.5px] border-outline bg-surface-container-lowest",
                )}
              />
            </div>
            <p
              className={cn(
                "mt-2 truncate font-body text-sm",
                step.progress === "current"
                  ? "font-medium text-on-surface"
                  : "text-on-surface-variant",
              )}
            >
              {step.label}
              <span className="sr-only">, {PROGRESS_TEXT[step.progress]}</span>
            </p>
            {step.date ? (
              <p className="mt-0.5 truncate font-body text-xs text-on-surface-variant">
                {step.date}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
