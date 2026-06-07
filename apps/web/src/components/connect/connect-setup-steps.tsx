"use client";

import { cn } from "@auction/ui";
import { CheckCircle2, Circle } from "lucide-react";

type Props = {
  kycApproved: boolean;
  payoutComplete: boolean;
  className?: string;
};

type StepState = "complete" | "current" | "upcoming";

function stepState(complete: boolean, current: boolean): StepState {
  if (complete) return "complete";
  if (current) return "current";
  return "upcoming";
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "complete") {
    return <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />;
  }
  return (
    <Circle
      className={cn(
        "size-4 shrink-0",
        state === "current" ? "text-lot-orange" : "text-on-surface-variant/50",
      )}
      aria-hidden
    />
  );
}

function SetupStep({
  state,
  title,
  description,
}: {
  state: StepState;
  title: string;
  description: string;
}) {
  return (
    <li
      className="flex items-start gap-2 sm:items-center"
      aria-current={state === "current" ? "step" : undefined}
    >
      <StepIcon state={state} />
      <div>
        <p className="font-headline text-sm font-semibold text-on-surface">{title}</p>
        <p className="font-body text-xs text-on-surface-variant">{description}</p>
      </div>
    </li>
  );
}

export function ConnectSetupSteps({ kycApproved, payoutComplete, className }: Props) {
  const identityState = stepState(kycApproved, !kycApproved);
  const payoutState = stepState(payoutComplete, kycApproved && !payoutComplete);

  return (
    <ol
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border-hairline bg-surface-container-low p-4 sm:flex-row sm:items-center sm:gap-6",
        className,
      )}
      aria-label="Payout setup progress"
    >
      <SetupStep
        state={identityState}
        title="Identity verification"
        description={kycApproved ? "Complete" : "Required before payout setup"}
      />
      <li className="hidden h-px flex-1 bg-outline-variant/30 sm:block" aria-hidden />
      <SetupStep
        state={payoutState}
        title="Payout details"
        description={
          payoutComplete
            ? "Complete"
            : kycApproved
              ? "Add bank details and verification below"
              : "Available after identity verification"
        }
      />
    </ol>
  );
}
