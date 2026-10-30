"use client";

// A client component: the step buttons are links inside the LAX Button (a Radix Slot), and a Slot
// renders nothing when the server streams its child as a deferred reference.
import type { FirstStepView, FirstStepsView } from "@/lib/organisation-home/organisation-home-view";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { Check, Clock } from "lucide-react";
import Link from "next/link";
import { HomePanel } from "./home-section";

function StepMarker({ step, index }: { step: FirstStepView; index: number }) {
  const base = "grid size-7 shrink-0 place-items-center rounded-full text-lax-13 font-semibold";
  if (step.state === "done") {
    return (
      <span className={cn(base, "bg-lax-success-bg text-lax-success-fg")}>
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Done:</span>
      </span>
    );
  }
  if (step.state === "waiting") {
    return (
      <span className={cn(base, "bg-lax-info-bg text-lax-info-fg")}>
        <Clock className="size-3.5" strokeWidth={2} aria-hidden />
        <span className="sr-only">With us:</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        step.state === "next"
          ? "bg-lax-ink text-lax-on-ink"
          : "text-lax-muted shadow-[inset_0_0_0_1.5px_var(--color-lax-line-strong)]",
      )}
    >
      <span className="sr-only">Step </span>
      {index + 1}
    </span>
  );
}

/**
 * A new organisation's first steps, for the people who run it: documents, payouts, then the team.
 * Setup is a step here, never a banner; the step to take now is shaded and has the one primary
 * button. Done steps stay, quietly, so progress reads at a glance.
 */
export function HomeFirstSteps({ firstSteps }: { firstSteps: FirstStepsView }) {
  const { steps, done } = firstSteps;
  const percent = Math.round((done / steps.length) * 100);
  return (
    <section aria-labelledby="home-first-steps" data-testid="home-first-steps">
      <HomePanel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-lax-line-subtle px-5 py-4 sm:px-6 sm:py-5">
          <h2
            id="home-first-steps"
            className="font-lax-display text-lax-18 font-semibold text-lax-fg"
          >
            First steps
          </h2>
          <div className="flex w-full items-center gap-3 text-lax-13 text-lax-muted sm:ml-auto sm:w-auto">
            <span className="tabular-nums">
              {done} of {steps.length} done
            </span>
            {/* The words beside it say the same; the bar is only a picture of them. */}
            <span
              aria-hidden
              className="h-1 flex-1 overflow-hidden rounded-full bg-lax-line sm:w-30 sm:flex-none"
            >
              <span className="block h-full bg-lax-fg" style={{ width: `${percent}%` }} />
            </span>
          </div>
        </div>
        <ol>
          {steps.map((step, index) => (
            <li
              key={step.id}
              data-state={step.state}
              data-testid={`home-step-${step.id}`}
              className={cn(
                "grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-t border-lax-line-subtle px-5 py-4 first:border-t-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-6 sm:py-5",
                step.state === "next" && "bg-lax-sunken",
              )}
            >
              <StepMarker step={step} index={index} />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-lax-14",
                    step.state === "done" ? "text-lax-muted" : "font-medium text-lax-fg",
                  )}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-lax-13 text-pretty text-lax-muted">{step.detail}</p>
              </div>
              {step.action ? (
                <Button
                  asChild
                  variant={step.action.primary ? "primary" : "secondary"}
                  className="col-start-2 h-11 sm:col-start-3 sm:h-lax-control-md"
                >
                  <Link href={step.action.href}>{step.action.label}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </HomePanel>
    </section>
  );
}
