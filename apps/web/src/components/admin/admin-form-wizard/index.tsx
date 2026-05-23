"use client";

import { isEditableTarget } from "@/lib/hotkeys/is-editable-target";
import { cn } from "@auction/ui";
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
import {
  createWizardStepOwner,
  publishWizardStep,
  registerWizardMobileNavigation,
  resetWizardStepSync,
} from "./wizard-step-sync";

export type AdminFormWizardProps = {
  steps: readonly WizardStepSpec[];
  /** Step body — static node or render prop receiving the active step index. */
  children: ReactNode | ((stepIndex: number) => ReactNode);
  /** When true, parent should mount {@link FormDirtyGuard} for unsaved-change prompts. */
  isDirty?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  /** Footer actions on the last step (submit + cancel). */
  submitSlot?: ReactNode;
  /** Optional extra actions shown in sticky bar on every step (e.g. cancel). */
  leadingSlot?: ReactNode;
  pending?: boolean;
  className?: string;
  /** When set, autosaves draft every 30s while dirty and shows resume banner on load. */
  draft?: {
    entityKind: string;
    entityId: string;
    getValues?: () => Record<string, unknown>;
  };
  /** Hydrate owning form fields when operator chooses Resume draft. */
  onDraftResume?: (payload: WizardDraftPayload) => void;
  /** Return false to block advancing to the next step (e.g. field validation). */
  onBeforeNext?: (stepIndex: number) => boolean | Promise<boolean>;
  /** Hide duplicate sticky submit on mobile when CatalogMobileActionBar submits the form. */
  hideStickyOnMobile?: boolean;
  /** Exposes goTo for submit-time navigation to the first invalid step. */
  onStepControl?: (control: { goTo: (index: number) => void }) => void;
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
  hideStickyOnMobile = false,
  onStepControl,
}: AdminFormWizardProps) {
  const draftKey = draft ? wizardDraftCookieKey(draft.entityKind, draft.entityId) : null;
  const { stepIndex, goNext, goPrev, goTo, isFirst, isLast, setDirty } = useWizardState(
    steps.length,
    0,
  );
  const [showResume, setShowResume] = useState(false);
  const [storedDraft, setStoredDraft] = useState<WizardDraftPayload | null>(null);
  const [stepJumpPending, setStepJumpPending] = useState(false);
  const submitRef = useRef<HTMLDivElement>(null);
  const draftGetValuesRef = useRef(draft?.getValues);
  draftGetValuesRef.current = draft?.getValues;

  const persistDraft = useCallback(() => {
    if (!draftKey || !isDirty) return;
    writeWizardDraft(draftKey, {
      stepIndex,
      values: draftGetValuesRef.current?.() ?? {},
      savedAt: new Date().toISOString(),
    });
  }, [draftKey, isDirty, stepIndex]);

  useEffect(() => {
    setDirty(isDirty);
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange, setDirty]);

  useEffect(() => {
    if (!draftKey) return;
    const found = readWizardDraft(draftKey);
    if (!found) return;
    setStoredDraft(found);
    setShowResume(true);
  }, [draftKey]);

  const wizardOwnerRef = useRef<symbol | null>(null);
  if (wizardOwnerRef.current === null) {
    wizardOwnerRef.current = createWizardStepOwner();
  }

  useEffect(() => {
    const owner = wizardOwnerRef.current;
    if (!owner) return;
    publishWizardStep(owner, { stepIndex, stepCount: steps.length, pending });
  }, [pending, stepIndex, steps.length]);

  useEffect(() => {
    const owner = wizardOwnerRef.current;
    return () => {
      if (owner) resetWizardStepSync(owner);
    };
  }, []);

  const onStepControlRef = useRef(onStepControl);
  onStepControlRef.current = onStepControl;
  useEffect(() => {
    onStepControlRef.current?.({ goTo });
  }, [goTo]);

  const handleNext = useCallback(async () => {
    if (onBeforeNext) {
      const ok = await onBeforeNext(stepIndex);
      if (!ok) return;
    }
    persistDraft();
    goNext();
  }, [goNext, onBeforeNext, persistDraft, stepIndex]);

  useEffect(() => {
    const owner = wizardOwnerRef.current;
    if (!owner) return;
    registerWizardMobileNavigation(owner, { requestNext: handleNext });
    return () => registerWizardMobileNavigation(owner, null);
  }, [handleNext]);

  const handleStepClick = useCallback(
    async (targetIndex: number) => {
      if (stepJumpPending || targetIndex === stepIndex) return;
      if (targetIndex < stepIndex) {
        persistDraft();
        goTo(targetIndex);
        return;
      }
      setStepJumpPending(true);
      try {
        for (let i = stepIndex; i < targetIndex; i++) {
          if (onBeforeNext) {
            const ok = await onBeforeNext(i);
            if (!ok) {
              goTo(i);
              return;
            }
          }
        }
        persistDraft();
        goTo(targetIndex);
      } finally {
        setStepJumpPending(false);
      }
    },
    [goTo, onBeforeNext, persistDraft, stepIndex, stepJumpPending],
  );

  const handleBack = useCallback(() => {
    persistDraft();
    goPrev();
  }, [goPrev, persistDraft]);

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
    if (!draftKey || !isDirty) return;
    const timer = window.setInterval(() => {
      persistDraft();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [draftKey, isDirty, persistDraft]);

  useEffect(() => {
    if (!draftKey || !isDirty) return;
    const onPageHide = () => persistDraft();
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, [draftKey, isDirty, persistDraft]);

  const stepBody = typeof children === "function" ? children(stepIndex) : children;

  return (
    <div className={className ?? "space-y-8"}>
      {showResume && storedDraft ? (
        <WizardResumeBanner
          draft={storedDraft}
          onResume={() => {
            onDraftResume?.(storedDraft);
            goTo(storedDraft.stepIndex);
            setShowResume(false);
          }}
          onDiscard={() => {
            if (draftKey) clearWizardDraft(draftKey);
            setStoredDraft(null);
            setShowResume(false);
          }}
        />
      ) : null}
      <div className="border-b border-border-hairline pb-4">
        <WizardStepIndicator
          steps={steps}
          currentIndex={stepIndex}
          onStepClick={(index) => void handleStepClick(index)}
          stepNavigationDisabled={stepJumpPending || pending}
        />
      </div>
      <div className="min-h-[12rem]">{stepBody}</div>
      <StickySaveBar className={cn(hideStickyOnMobile && "hidden md:block")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {leadingSlot ?? <span />}
          <div ref={submitRef}>
            <WizardActions
              isFirst={isFirst}
              isLast={isLast}
              onBack={handleBack}
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
