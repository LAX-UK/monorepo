"use client";

import { Check } from "lucide-react";
import type * as React from "react";
import { type KeyValueItem, KeyValueList } from "../display/key-value-list.js";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type WizardStep = {
  id: string;
  label: string;
  /** One line under the label in the vertical layout. */
  description?: string;
};

/**
 * Where a multi-step creation flow is: each step's name, the steps done (a tick), the current one
 * and those to come. Done steps can be revisited; later steps are reached with Continue, which
 * validates the step first. Horizontal above the form, or vertical beside it.
 */
export function StepIndicator({
  steps,
  currentIndex,
  onStepClick,
  disabled = false,
  orientation = "horizontal",
  label = "Steps",
  className,
}: {
  steps: readonly WizardStep[];
  currentIndex: number;
  /** Go to a step; leave out to show the steps without links. */
  onStepClick?: (index: number) => void;
  /** While a step is validating or saving. */
  disabled?: boolean;
  /** "responsive": a row of steps on small screens, a column beside the form from `lg`. */
  orientation?: "horizontal" | "vertical" | "responsive";
  label?: string;
  className?: string;
}) {
  const vertical = orientation === "vertical";
  const responsive = orientation === "responsive";
  return (
    <nav aria-label={label} className={className}>
      <p className="sr-only">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
      </p>
      <ol
        className={cn(
          "flex",
          vertical ? "flex-col gap-1" : "flex-wrap items-center gap-x-1 gap-y-2",
          responsive && "lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-1",
        )}
      >
        {steps.map((step, index) => {
          const state = index === currentIndex ? "current" : index < currentIndex ? "done" : "todo";
          const marker = (
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-staff-xs font-medium tabular-nums",
                state === "current" && "border-staff-ink bg-staff-ink text-staff-on-ink",
                state === "done" && "border-staff-ink text-staff-fg",
                state === "todo" && "border-staff-control-border text-staff-muted",
              )}
            >
              {state === "done" ? <Check className="size-3 stroke-[2.5]" /> : index + 1}
            </span>
          );
          const text = (
            <span className="flex min-w-0 flex-col text-left">
              <span
                className={cn(
                  "text-staff-sm",
                  state === "current" ? "font-medium text-staff-fg" : "text-staff-muted",
                  state === "done" && "text-staff-fg",
                )}
              >
                {step.label}
              </span>
              {(vertical || responsive) && step.description ? (
                <span
                  className={cn("text-staff-xs text-staff-muted", responsive && "hidden lg:block")}
                >
                  {step.description}
                </span>
              ) : null}
            </span>
          );
          const clickable = onStepClick !== undefined && state === "done" && !disabled;
          const row = cn(
            "flex min-h-control-sm items-start gap-2 rounded-staff-sm px-2 py-1.5",
            vertical ? "w-full" : "items-center",
            responsive && "lg:w-full lg:items-start",
          );
          return (
            <li
              key={step.id}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex",
                vertical ? "flex-col" : "items-center gap-1",
                responsive && "lg:flex-col lg:items-stretch lg:gap-0",
              )}
            >
              {clickable ? (
                <button
                  type="button"
                  className={cn(row, "staff-focus transition-colors hover:staff-overlay-hover")}
                  onClick={() => onStepClick(index)}
                >
                  {marker}
                  {text}
                  <span className="sr-only">(done, go back to this step)</span>
                </button>
              ) : (
                <span className={row}>
                  {marker}
                  {text}
                  {state === "done" ? <span className="sr-only">(done)</span> : null}
                </span>
              )}
              {!vertical && index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn("h-px w-4 bg-staff-line-strong", responsive && "lg:hidden")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A step's title, what it is for and, optionally, what comes next, above its fields. */
export function StepHeader({
  title,
  description,
  next,
}: {
  title: string;
  description?: React.ReactNode;
  /** What the following step covers. */
  next?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1 border-b border-staff-line-subtle pb-4">
      <h2 className="font-staff text-staff-lg font-semibold text-staff-fg">{title}</h2>
      {description ? <p className="text-staff-sm text-staff-muted">{description}</p> : null}
      {next ? (
        <p className="text-staff-xs text-staff-muted">
          <span className="font-medium text-staff-fg">Next:</span> {next}
        </p>
      ) : null}
    </header>
  );
}

/**
 * One step's answers on a "Check your answers" step, with Change to go back to it. Empty answers
 * show an em dash, so a missing answer is visible.
 */
export function ReviewSection({
  title,
  items,
  onChange,
  changeLabel = "Change",
}: {
  title: string;
  items: readonly KeyValueItem[];
  onChange?: () => void;
  changeLabel?: string;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-staff-lg border border-staff-line bg-staff-surface"
    >
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-staff-line-subtle px-4 py-2">
        <h3 className="font-staff text-staff-md font-semibold text-staff-fg">{title}</h3>
        {onChange ? (
          <StaffButton size="sm" variant="ghost" onClick={onChange}>
            {changeLabel}
            <span className="sr-only"> {title.toLowerCase()}</span>
          </StaffButton>
        ) : null}
      </header>
      <div className="px-4 py-2">
        <KeyValueList items={items} />
      </div>
    </section>
  );
}
