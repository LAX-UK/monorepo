"use client";

import type { BuyerSourceOfFundsView } from "@/lib/data/http/compliance.server";
import { cn } from "@auction/ui/lib/utils";

type Step = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming";
};

function buildSteps(view: BuyerSourceOfFundsView): Step[] {
  if (view.decisionOutcome === "approved" || view.decisionOutcome === "rejected") {
    return [
      {
        id: "outcome",
        label: view.decisionOutcome === "approved" ? "Verified" : "Outcome",
        state: "complete",
      },
    ];
  }

  const submitted = view.documentsSubmitted;
  const requested = view.documentsRequested;
  const hasUploads = view.documents.some((d) => d.statusLabel !== "superseded");

  const steps: Step[] = [
    {
      id: "opened",
      label: "Case opened",
      state: requested || submitted || hasUploads ? "complete" : "current",
    },
    {
      id: "requested",
      label: "Documents requested",
      state: requested ? (submitted || hasUploads ? "complete" : "current") : "upcoming",
    },
    {
      id: "upload",
      label: "Upload documents",
      state: hasUploads ? (submitted ? "complete" : "current") : requested ? "current" : "upcoming",
    },
    {
      id: "submitted",
      label: "Submitted for review",
      state: submitted ? "complete" : hasUploads ? "current" : "upcoming",
    },
    {
      id: "decision",
      label: "Compliance decision",
      state: submitted ? "current" : "upcoming",
    },
  ];

  return steps;
}

type Props = {
  view: BuyerSourceOfFundsView;
};

export function SofProgressStepper({ view }: Props) {
  const steps = buildSteps(view);
  if (steps.length === 1) return null;

  return (
    <nav aria-label="Verification progress" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full font-label text-[10px] font-semibold",
                  step.state === "complete" && "bg-primary text-on-primary",
                  step.state === "current" && "border-2 border-primary text-primary",
                  step.state === "upcoming" &&
                    "border border-border-hairline text-on-surface-variant",
                )}
                aria-hidden
              >
                {step.state === "complete" ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "font-body text-xs",
                  step.state === "current"
                    ? "font-medium text-on-surface"
                    : "text-on-surface-variant",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className="h-px w-6 bg-border-hairline" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
