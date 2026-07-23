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
import {
  WizardDraftSaveIndicator,
  type WizardDraftSaveStatus,
} from "./wizard-draft-save-indicator";
import { WizardResumeBanner } from "./wizard-resume-banner";
import {
  type WizardMobileCancelAction,
  type WizardMobilePrimaryAction,
  createWizardStepOwner,
  publishWizardStep,
  registerWizardMobileCancel,
  registerWizardMobileNavigation,
  registerWizardMobilePrimary,
  resetWizardStepSync,
} from "./wizard-step-sync";
import { WizardVerticalStepper } from "./wizard-vertical-stepper";

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
  /** Fired when navigating to an earlier step (Back button or backward step click). */
  onStepBack?: (toIndex: number) => void;
  /** Hide duplicate sticky submit on mobile when CatalogMobileActionBar submits the form. */
  hideStickyOnMobile?: boolean;
  /** When false, action bar sits inline after step content (staff must scroll to reach it). */
  stickyActions?: boolean;
  /** When true, submitSlot is shown on every step (edit flows). */
  showSubmitOnAllSteps?: boolean;
  /** Exposes goTo for submit-time navigation to the first invalid step. */
  onStepControl?: (control: { goTo: (index: number) => void }) => void;
  /** Custom mobile primary action (overrides form submit on last step). */
  mobilePrimaryAction?: WizardMobilePrimaryAction | null;
  /** Custom mobile cancel (overrides static cancel href). */
  mobileCancelAction?: WizardMobileCancelAction | null;
  /**
   * `sidebar`: form body left, vertical stepper right on lg+ (Figma sale wizard).
   * `default`: horizontal step chips above the form.
   */
  layout?: "default" | "sidebar";
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
  stickyActions = true,
  showSubmitOnAllSteps = false,
  onStepControl,
  onStepBack,
  mobilePrimaryAction = null,
  mobileCancelAction = null,
  layout = "default",
}: AdminFormWizardProps) {
  const draftKey = draft ? wizardDraftCookieKey(draft.entityKind, draft.entityId) : null;
  const { stepIndex, goNext, goPrev, goTo, isFirst, isLast, setDirty } = useWizardState(
    steps.length,
    0,
  );
  const [showResume, setShowResume] = useState(false);
  const [storedDraft, setStoredDraft] = useState<WizardDraftPayload | null>(null);
  const [stepJumpPending, setStepJumpPending] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<WizardDraftSaveStatus>("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const submitRef = useRef<HTMLDivElement>(null);
  const draftGetValuesRef = useRef(draft?.getValues);
  draftGetValuesRef.current = draft?.getValues;

  const persistDraft = useCallback(() => {
    if (!draftKey || !isDirty) return;
    setDraftSaveStatus("saving");
    writeWizardDraft(draftKey, {
      stepIndex,
      values: draftGetValuesRef.current?.() ?? {},
      savedAt: new Date().toISOString(),
    });
    const savedAt = new Date().toISOString();
    setDraftSavedAt(savedAt);
    setDraftSaveStatus("saved");
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

  useEffect(() => {
    const owner = wizardOwnerRef.current;
    if (!owner) return;
    registerWizardMobilePrimary(owner, mobilePrimaryAction);
    return () => registerWizardMobilePrimary(owner, null);
  }, [mobilePrimaryAction]);

  useEffect(() => {
    const owner = wizardOwnerRef.current;
    if (!owner) return;
    registerWizardMobileCancel(owner, mobileCancelAction);
    return () => registerWizardMobileCancel(owner, null);
  }, [mobileCancelAction]);

  const handleStepClick = useCallback(
    async (targetIndex: number) => {
      if (stepJumpPending || targetIndex === stepIndex) return;
      if (targetIndex < stepIndex) {
        persistDraft();
        onStepBack?.(targetIndex);
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
    [goTo, onBeforeNext, onStepBack, persistDraft, stepIndex, stepJumpPending],
  );

  const handleBack = useCallback(() => {
    persistDraft();
    onStepBack?.(Math.max(0, stepIndex - 1));
    goPrev();
  }, [goPrev, onStepBack, persistDraft, stepIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
      if (isEditableTarget(event.target)) return;
      if (pending) return;
      event.preventDefault();
      if (isLast || showSubmitOnAllSteps) {
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
  }, [handleNext, isLast, pending, showSubmitOnAllSteps]);

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
  const nextStepLabel = steps[stepIndex + 1]?.label;
  const useSidebar = layout === "sidebar";

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
      {useSidebar ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-col gap-2 border-b border-border-hairline pb-4 lg:hidden">
              <WizardStepIndicator
                steps={steps}
                currentIndex={stepIndex}
                onStepClick={(index) => void handleStepClick(index)}
                stepNavigationDisabled={stepJumpPending || pending}
              />
              {draftKey ? (
                <WizardDraftSaveIndicator status={draftSaveStatus} savedAt={draftSavedAt} />
              ) : null}
            </div>
            <div className="min-h-[12rem]">{stepBody}</div>
          </div>
          <aside className="hidden lg:block lg:sticky lg:top-24">
            <WizardVerticalStepper
              steps={steps}
              currentIndex={stepIndex}
              onStepClick={(index) => void handleStepClick(index)}
              stepNavigationDisabled={stepJumpPending || pending}
            />
            {draftKey ? (
              <div className="mt-4 border-t border-outline-variant/30 pt-4">
                <WizardDraftSaveIndicator status={draftSaveStatus} savedAt={draftSavedAt} />
              </div>
            ) : null}
          </aside>
        </div>
      ) : (
        <>
          <div className="border-b border-border-hairline pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <WizardStepIndicator
                steps={steps}
                currentIndex={stepIndex}
                onStepClick={(index) => void handleStepClick(index)}
                stepNavigationDisabled={stepJumpPending || pending}
              />
              {draftKey ? (
                <WizardDraftSaveIndicator status={draftSaveStatus} savedAt={draftSavedAt} />
              ) : null}
            </div>
          </div>
          <div className="min-h-[12rem]">{stepBody}</div>
        </>
      )}
      <StickySaveBar
        sticky={stickyActions}
        className={cn(stickyActions && hideStickyOnMobile && "hidden lg:block")}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {leadingSlot ?? <span />}
          <div ref={submitRef}>
            <WizardActions
              isFirst={isFirst}
              isLast={isLast}
              onBack={handleBack}
              onNext={() => void handleNext()}
              submitSlot={submitSlot}
              showSubmitOnAllSteps={showSubmitOnAllSteps}
              pending={pending}
              {...(nextStepLabel ? { nextLabel: nextStepLabel } : {})}
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
