import type { OrgOnboardingStepKey } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

const STEPS: { key: OrgOnboardingStepKey; label: string }[] = [
  { key: "type", label: "Type" },
  { key: "details", label: "Details" },
  { key: "documents", label: "Documents" },
  { key: "connect", label: "Connect" },
  { key: "identity", label: "Identity" },
];

type Props = {
  /** Step the user should focus on next (drives highlight). */
  currentKey: OrgOnboardingStepKey;
  entityId: string;
};

function stepHref(key: OrgOnboardingStepKey, entityId: string) {
  return `/onboarding/organisation/step/${key}?entityId=${encodeURIComponent(entityId)}`;
}

export function OnboardingProgressBar({ currentKey, entityId }: Props) {
  const currentIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.key === currentKey),
  );

  return (
    <ol className="flex flex-wrap gap-2" aria-label="Onboarding steps">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.key}>
            <Link
              href={stepHref(step.key, entityId)}
              prefetch
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active &&
                  "border-primary bg-primary text-on-primary [&_span]:bg-on-primary/20 [&_span]:text-on-primary",
                done &&
                  !active &&
                  "border-outline-variant/30 bg-surface-container-high text-on-surface",
                !done &&
                  !active &&
                  "border-border-hairline bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  active ? "bg-on-primary/20" : "bg-outline-variant/25 text-on-surface-variant",
                )}
              >
                {i + 1}
              </span>
              {step.label}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
