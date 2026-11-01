"use client";

import { DraftResumeToast } from "@/components/dashboard/submission-wizard/draft-resume-toast";
import { BasicsStep } from "@/components/dashboard/submission-wizard/steps/basics-step";
import { DetailsStep } from "@/components/dashboard/submission-wizard/steps/details-step";
import { PhotosStep } from "@/components/dashboard/submission-wizard/steps/photos-step";
import { PricingStep } from "@/components/dashboard/submission-wizard/steps/pricing-step";
import { ProvenanceStep } from "@/components/dashboard/submission-wizard/steps/provenance-step";
import { ReviewStep } from "@/components/dashboard/submission-wizard/steps/review-step";
import { SubmissionDraftContextStrip } from "@/components/dashboard/submission-wizard/submission-draft-context-strip";
import { WizardFooter } from "@/components/dashboard/submission-wizard/wizard-footer";
import { WizardHeaderActions } from "@/components/dashboard/submission-wizard/wizard-header-actions";
import { WizardStepper } from "@/components/dashboard/submission-wizard/wizard-stepper";
import { trackWizardStepComplete } from "@/lib/analytics/sell-funnel";
import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import {
  WIZARD_STEPS,
  WIZARD_STEP_COUNT,
  type WizardStepId,
} from "@/lib/forms/submission/step-validation";
import { submissionExitGuardActive } from "@/lib/forms/submission/submission-exit-guard";
import { sanitizeSubmissionFormValues } from "@/lib/forms/submission/submission-form-data";
import {
  type SubmissionWizardController,
  type WizardMode,
  useSubmissionWizardController,
} from "@/lib/forms/submission/use-submission-wizard-controller";
import {
  SPECIALIST_RESPONSE_PROMISE,
  SUBMISSION_FINISH_LATER_LABEL,
  SUBMISSION_SUBMIT_LABEL,
} from "@/lib/marketing/sell-flow-copy";
import { HideBottomTabBarWhileMounted } from "@/lib/shell/shell-chrome-context";
import { evaluateSubmissionQuality } from "@auction/domain";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Form } from "@auction/ui/components/form";
import { Surface } from "@auction/ui/components/surface";
import type { WizardProgressStep } from "@auction/ui/components/wizard-progress";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Props = {
  mode: WizardMode;
  categories: SubmissionCategoryOption[];
  initialValues?: ItemSubmissionFormValues;
  /** Resume wizard at a specific step (e.g. first incomplete or review when ready). */
  initialStepIndex?: number;
  /** Show ready-to-submit toast instead of generic resume toast. */
  readyToSubmit?: boolean;
  /** Label of the final button, for example "Send back for review" after changes. */
  submitLabel?: string;
};

/**
 * What the review step's primary button does. By default it submits; "Sell a work" makes it
 * continue to "Who is selling?" instead, and submits from there.
 */
export type SubmissionWizardPrimaryAction = { label: string; onActivate: () => void };

type ViewProps = Omit<Props, "initialValues" | "submitLabel"> & {
  controller: SubmissionWizardController;
  primaryAction?: SubmissionWizardPrimaryAction;
  submitLabel?: string;
  /** Steps the surrounding flow adds after the form's own, shown in the same progress bar. */
  trailingSteps?: readonly WizardProgressStep[];
  /** A section the flow puts first in the check-and-send step ("Selling as"). */
  reviewLead?: ReactNode;
};

function renderStep(
  stepId: WizardStepId,
  props: {
    form: ReturnType<typeof useSubmissionWizardController>["form"];
    isSubmitting: boolean;
    categories: SubmissionCategoryOption[];
    onJumpTo: (index: number) => void;
    finishLater: () => void;
    submitForReview: () => void;
    submitLabel: string;
    reviewLead: ReactNode;
  },
) {
  const base = { form: props.form, isSubmitting: props.isSubmitting };
  switch (stepId) {
    case "basics":
      return <BasicsStep {...base} categories={props.categories} />;
    case "details":
      return <DetailsStep {...base} />;
    case "photos":
      return <PhotosStep {...base} />;
    case "provenance":
      return <ProvenanceStep {...base} />;
    case "pricing":
      return <PricingStep {...base} />;
    case "review":
      return (
        <ReviewStep
          {...base}
          onJumpTo={props.onJumpTo}
          canSubmitForReview
          onFinishLater={props.finishLater}
          onSubmitForReview={props.submitForReview}
          submitLabel={props.submitLabel}
          lead={props.reviewLead}
        />
      );
    default:
      return null;
  }
}

/** The submission form, owning its own save and submit. */
export function SubmissionWizard({ initialValues, ...props }: Props) {
  const controller = useSubmissionWizardController(props.mode, initialValues);
  return <SubmissionWizardView {...props} controller={controller} />;
}

/** The submission form around a controller the caller owns (see "Sell a work"). */
export function SubmissionWizardView({
  mode,
  categories,
  initialStepIndex = 0,
  readyToSubmit = false,
  controller,
  primaryAction,
  submitLabel = SUBMISSION_SUBMIT_LABEL,
  trailingSteps = [],
  reviewLead = null,
}: ViewProps) {
  const router = useRouter();
  const { form, isSubmitting, autosaveStatus, lastSavedAt, saveDraft, submitForReview } =
    controller;
  const primaryLabel = primaryAction?.label ?? submitLabel;

  const clampedInitial = Math.max(0, Math.min(initialStepIndex, WIZARD_STEP_COUNT - 1));
  const [stepIndex, setStepIndex] = useState(clampedInitial);
  const [maxReachableIndex, setMaxReachableIndex] = useState(clampedInitial);
  const [exitGuardOpen, setExitGuardOpen] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<"leave" | "navigate" | null>(null);
  const pendingNavigateHref = useRef<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstStepShown = useRef(true);
  const submittedThisSession = useRef(false);

  const currentStep = WIZARD_STEPS[stepIndex];
  const nextStep = WIZARD_STEPS[stepIndex + 1];
  const isLastStep = stepIndex === WIZARD_STEP_COUNT - 1;
  const showAutosave = mode.kind === "edit" || controller.submissionId != null;

  const formValues = form.watch();
  const quality = evaluateSubmissionQuality({
    title: formValues.title,
    images: formValues.images,
    description: formValues.description,
    provenance: formValues.provenance,
    categoryId: formValues.categoryIds[0] ?? "",
    categoryIds: formValues.categoryIds,
  });
  const exitGuardActive = submissionExitGuardActive({
    isReviewStep: isLastStep,
    canSubmit: quality.canSubmit,
    submittedThisSession: submittedThisSession.current,
  });

  const goToStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(index, WIZARD_STEP_COUNT - 1)));
  }, []);

  const validateCurrentStep = useCallback(async () => {
    if (!currentStep || currentStep.fields.length === 0) return true;
    if (currentStep.id === "provenance") {
      const sanitized = sanitizeSubmissionFormValues(form.getValues());
      form.setValue("provenance", sanitized.provenance, { shouldDirty: true });
      form.setValue("exhibitions", sanitized.exhibitions, { shouldDirty: true });
    }
    const ok = await form.trigger([...currentStep.fields], { shouldFocus: true });
    if (!ok) {
      window.requestAnimationFrame(() => {
        const firstInvalid = document.querySelector("[aria-invalid='true']");
        firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    return ok;
  }, [currentStep, form]);

  const handleNext = useCallback(async () => {
    const ok = await validateCurrentStep();
    if (!ok) return;
    const next = Math.min(stepIndex + 1, WIZARD_STEP_COUNT - 1);
    const step = WIZARD_STEPS[stepIndex];
    if (step) trackWizardStepComplete(step.id, stepIndex);
    setMaxReachableIndex((prev) => Math.max(prev, next));
    setStepIndex(next);
  }, [stepIndex, validateCurrentStep]);

  const handleBack = useCallback(() => {
    goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const handleFinishLater = useCallback(() => {
    void saveDraft({ leaveAfter: true });
  }, [saveDraft]);

  const handleSubmitForReview = useCallback(() => {
    submittedThisSession.current = true;
    void submitForReview();
  }, [submitForReview]);

  const handlePrimary = useCallback(() => {
    if (primaryAction) {
      primaryAction.onActivate();
      return;
    }
    handleSubmitForReview();
  }, [handleSubmitForReview, primaryAction]);

  const requestLeaveWithoutSaving = useCallback(() => {
    if (exitGuardActive) {
      setPendingExitAction("leave");
      setExitGuardOpen(true);
      return;
    }
    router.push("/selling/consignments");
  }, [exitGuardActive, router]);

  // Moving between steps takes focus to the new step's heading, so it is announced. Opening the
  // form does not: the page loads in reading order with nothing focused.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus step heading on navigation
  useEffect(() => {
    if (firstStepShown.current) {
      firstStepShown.current = false;
      return;
    }
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isLastStep) {
        e.preventDefault();
        void handleNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, isLastStep]);

  useEffect(() => {
    if (!exitGuardActive) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [exitGuardActive]);

  useEffect(() => {
    if (!exitGuardActive) return;
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      if (!href.startsWith("/")) return;
      const currentPath = window.location.pathname;
      if (href === currentPath || href.startsWith(`${currentPath}?`)) return;
      event.preventDefault();
      event.stopPropagation();
      pendingNavigateHref.current = href;
      setPendingExitAction("navigate");
      setExitGuardOpen(true);
    };
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [exitGuardActive]);

  const clearPendingExit = useCallback(() => {
    pendingNavigateHref.current = null;
    setPendingExitAction(null);
  }, []);

  return (
    <>
      {mode.kind === "edit" ? <DraftResumeToast readyToSubmit={readyToSubmit} /> : null}
      <HideBottomTabBarWhileMounted />
      <Dialog
        open={exitGuardOpen}
        onOpenChange={(open) => {
          setExitGuardOpen(open);
          if (!open) clearPendingExit();
        }}
      >
        <DialogContent className="max-w-md border-border-hairline">
          <DialogHeader>
            <DialogTitle>You haven&apos;t sent it yet</DialogTitle>
            <DialogDescription>
              Your work won&apos;t be reviewed until you send it. {SPECIALIST_RESPONSE_PROMISE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="cta"
              disabled={isSubmitting}
              onClick={() => {
                setExitGuardOpen(false);
                handlePrimary();
              }}
            >
              {primaryLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setExitGuardOpen(false);
                const action = pendingExitAction;
                const href = pendingNavigateHref.current;
                clearPendingExit();
                if (action === "navigate" && href) {
                  void (async () => {
                    const ok = await saveDraft({ leaveAfter: false, skipRedirect: true });
                    if (ok) router.push(href);
                  })();
                  return;
                }
                if (action === "leave") {
                  void saveDraft({ leaveAfter: true });
                }
              }}
            >
              {SUBMISSION_FINISH_LATER_LABEL}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setExitGuardOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Form {...form}>
        <form
          className="space-y-6 pb-[var(--page-bottom-padding)] sm:pb-24"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {showAutosave ? (
            <SubmissionDraftContextStrip
              autosaveStatus={autosaveStatus}
              lastSavedAt={lastSavedAt}
              showAutosave={showAutosave}
            />
          ) : null}
          <WizardStepper
            activeIndex={stepIndex}
            maxReachableIndex={maxReachableIndex}
            onStepClick={(index) => {
              if (index <= maxReachableIndex) goToStep(index);
            }}
            trailingSteps={trailingSteps}
            actions={
              <WizardHeaderActions
                isSubmitting={isSubmitting}
                // The last step carries its own "Save and finish later", beside the send button.
                showFinishLater={!isLastStep}
                onFinishLater={handleFinishLater}
                onLeaveWithoutSaving={requestLeaveWithoutSaving}
              />
            }
          />

          {currentStep ? (
            <h2
              id="submission-wizard-step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              // A heading is not a control: focus lands here for screen readers, with no ring.
              className="font-headline text-xl font-semibold text-on-surface outline-none"
            >
              {currentStep.label}
            </h2>
          ) : null}

          <Surface
            variant="section"
            padding="md"
            className="border-border-hairline"
            data-testid={currentStep ? `submission-wizard-step-${currentStep.id}` : undefined}
            aria-labelledby={currentStep ? "submission-wizard-step-heading" : undefined}
          >
            {currentStep
              ? renderStep(currentStep.id, {
                  form,
                  isSubmitting,
                  categories,
                  onJumpTo: goToStep,
                  finishLater: handleFinishLater,
                  submitForReview: handlePrimary,
                  submitLabel: primaryLabel,
                  reviewLead,
                })
              : null}
          </Surface>

          {!isLastStep ? (
            <WizardFooter
              isLastStep={isLastStep}
              isSubmitting={isSubmitting}
              autosaveStatus={autosaveStatus}
              lastSavedAt={lastSavedAt}
              showAutosave={showAutosave}
              {...(nextStep ? { nextStepLabel: nextStep.label } : {})}
              onBack={handleBack}
              onNext={() => void handleNext()}
              canGoBack={stepIndex > 0}
            />
          ) : null}
        </form>
      </Form>
    </>
  );
}
