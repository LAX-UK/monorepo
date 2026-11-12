"use client";

import type { AutosaveStatus } from "@/lib/forms/submission/use-submission-wizard-controller";
import { wizardAutosaveLabel } from "@/lib/forms/submission/wizard-autosave-label";
import { SUBMISSION_FINISH_LATER_LABEL } from "@/lib/marketing/sell-flow-copy";
import { WizardNav } from "@auction/ui/components/wizard-nav";
import { Button } from "@auction/ui/lax/button";
import { cn } from "@auction/ui/lib/utils";
import { useEffect, useRef } from "react";

/** The custom property the form reads, so a focused field scrolls to above the bar. */
export const WIZARD_BAR_HEIGHT_VAR = "--wizard-bar-height";

type Props = {
  isLastStep: boolean;
  isSubmitting: boolean;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  showAutosave: boolean;
  nextStepLabel?: string;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  /** Phone only: "Save and finish later" as a link above the bar. */
  onFinishLater?: () => void;
};

export function WizardFooter({
  isLastStep,
  isSubmitting,
  autosaveStatus,
  lastSavedAt,
  showAutosave,
  nextStepLabel,
  onBack,
  onNext,
  canGoBack,
  onFinishLater,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  // Tells the form how tall the bar is, so a field is never scrolled to behind it.
  useEffect(() => {
    const bar = barRef.current?.firstElementChild;
    const form = bar?.closest("form");
    if (!(bar instanceof HTMLElement) || !form || typeof ResizeObserver === "undefined") return;
    const publish = () => form.style.setProperty(WIZARD_BAR_HEIGHT_VAR, `${bar.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      form.style.removeProperty(WIZARD_BAR_HEIGHT_VAR);
    };
  }, []);

  const statusText = showAutosave ? wizardAutosaveLabel(autosaveStatus, lastSavedAt) : "";

  if (isLastStep) return null;

  return (
    <div ref={barRef} className="contents">
      <WizardNav
        isFirst={!canGoBack}
        isLast={false}
        onBack={onBack}
        onNext={onNext}
        pending={isSubmitting}
        layout="stretch"
        sticky
        {...(nextStepLabel ? { nextStepLabel } : {})}
        statusSlot={
          statusText || onFinishLater ? (
            <div className="flex flex-col items-center gap-2 sm:items-start">
              {onFinishLater ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={onFinishLater}
                  disabled={isSubmitting}
                  data-testid="wizard-finish-later-link"
                  className="bg-transparent px-2 underline decoration-1 underline-offset-4 hover:bg-transparent hover:decoration-2 active:bg-transparent sm:hidden"
                >
                  {SUBMISSION_FINISH_LATER_LABEL}
                </Button>
              ) : null}
              {statusText ? (
                <p
                  className={cn(
                    "min-h-5 font-label text-xs",
                    autosaveStatus === "error" ? "text-live-red" : "text-on-surface-variant",
                  )}
                  aria-live="polite"
                >
                  {statusText}
                </p>
              ) : null}
            </div>
          ) : null
        }
      />
    </div>
  );
}
