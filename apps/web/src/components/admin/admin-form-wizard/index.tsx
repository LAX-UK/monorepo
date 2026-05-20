"use client";

import { isEditableTarget } from "@/lib/hotkeys/is-editable-target";
import { StickySaveBar } from "@auction/ui";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { WizardStepIndicator, type WizardStepSpec } from "./step-indicator";
import { useWizardState } from "./use-wizard-state";
import { WizardActions } from "./wizard-actions";
import {
  type WizardDraftPayload,
  clearWizardDraft,
  readWizardDraft,
  wizardDraftCookieKey,
  writeWizardDraft,
} from "./wizard-draft";
import { WizardResumeBanner } from "./wizard-resume-banner";

export type AdminFormWizardProps = {
  steps: readonly WizardStepSpec[];
  /** Render prop for the active step body. */
  children: (stepIndex: number) => ReactNode;
  /** When true, enables beforeunload via parent FormDirtyGuard. */
  isDirty?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  /** Footer actions on the last step (submit + cancel). */
  submitSlot?: ReactNode;
  /** Optional extra actions shown in sticky bar on every step (e.g. cancel). */
  leadingSlot?: ReactNode;
  pending?: boolean;
  className?: string;
  /** When set, autosaves draft every 30s while dirty and shows resume banner on load. */
  draft?: { entityKind: string; entityId: string; values?: Record<string, unknown> };
  /** Hydrate owning form fields when operator chooses Resume draft. */
  onDraftResume?: (payload: WizardDraftPayload) => void;
  /** Return false to block advancing to the next step (e.g. field validation). */
  onBeforeNext?: (stepIndex: number) => boolean | Promise<boolean>;
};

/** Multi-step admin form shell with step indicator, navigation, and sticky actions. */
export function AdminFormWizard({
  steps,
  children,
  isDirty = false,
  onDirtyChange,
  submitSlot,
  leadingSlot,
  pending = false,
  className,
  draft,
  onDraftResume,
  onBeforeNext,
}: AdminFormWizardProps) {
  const draftKey = draft ? wizardDraftCookieKey(draft.entityKind, draft.entityId) : null;
  const initialDraft = draftKey ? readWizardDraft(draftKey) : null;
  const { stepIndex, goNext, goPrev, goTo, isFirst, isLast, setDirty } = useWizardState(
    steps.length,
    initialDraft?.stepIndex,
  );
  const [showResume, setShowResume] = useState(Boolean(initialDraft));
  const submitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDirty(isDirty);
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange, setDirty]);

  const handleNext = useCallback(async () => {
    if (onBeforeNext) {
      const ok = await onBeforeNext(stepIndex);
      if (!ok) return;
    }
    goNext();
  }, [goNext, onBeforeNext, stepIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
      if (isEditableTarget(event.target)) return;
      if (pending) return;
      event.preventDefault();
      if (isLast) {
        const submit = submitRef.current?.querySelector<HTMLButtonElement>(
          'button[type="submit"], button[data-wizard-submit="true"]',
        );
        submit?.click();
      } else {
        void handleNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, isLast, pending]);

  useEffect(() => {
    if (!draftKey || !isDirty || !draft) return;
    const timer = window.setInterval(() => {
      writeWizardDraft(draftKey, {
        stepIndex,
        values: draft.values ?? {},
        savedAt: new Date().toISOString(),
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [draft, draftKey, isDirty, stepIndex]);

  return (
    <div className={className ?? "space-y-8"}>
      {showResume && initialDraft ? (
        <WizardResumeBanner
          draft={initialDraft}
          onResume={() => {
            onDraftResume?.(initialDraft);
            goTo(initialDraft.stepIndex);
            setShowResume(false);
          }}
          onDiscard={() => {
            if (draftKey) clearWizardDraft(draftKey);
            setShowResume(false);
          }}
        />
      ) : null}
      <WizardStepIndicator steps={steps} currentIndex={stepIndex} onStepClick={goTo} />
      <div className="min-h-[12rem]">{children(stepIndex)}</div>
      <StickySaveBar>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {leadingSlot ?? <span />}
          <div ref={submitRef}>
            <WizardActions
              isFirst={isFirst}
              isLast={isLast}
              onBack={goPrev}
              onNext={() => void handleNext()}
              submitSlot={submitSlot}
              pending={pending}
            />
          </div>
        </div>
      </StickySaveBar>
    </div>
  );
}

export { useWizardState } from "./use-wizard-state";
export { WizardStepIndicator, type WizardStepSpec } from "./step-indicator";
export { WizardActions } from "./wizard-actions";
