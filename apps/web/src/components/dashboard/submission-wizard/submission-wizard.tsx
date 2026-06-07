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
import { sanitizeSubmissionFormValues } from "@/lib/forms/submission/submission-form-data";
import {
  type WizardMode,
  useSubmissionWizardController,
} from "@/lib/forms/submission/use-submission-wizard-controller";
import { HideBottomTabBarWhileMounted } from "@/lib/shell/shell-chrome-context";
import { Form } from "@auction/ui/components/form";
import { Surface } from "@auction/ui/components/surface";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  mode: WizardMode;
  categories: SubmissionCategoryOption[];
  initialValues?: ItemSubmissionFormValues;
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
        />
      );
    default:
      return null;
  }
}

export function SubmissionWizard({ mode, categories, initialValues }: Props) {
  const controller = useSubmissionWizardController(mode, initialValues);
  const { form, isSubmitting, autosaveStatus, lastSavedAt, saveDraft, submitForReview } =
    controller;

  const [stepIndex, setStepIndex] = useState(0);
  const [maxReachableIndex, setMaxReachableIndex] = useState(0);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const currentStep = WIZARD_STEPS[stepIndex];
  const nextStep = WIZARD_STEPS[stepIndex + 1];
  const isLastStep = stepIndex === WIZARD_STEP_COUNT - 1;
  const showAutosave = mode.kind === "edit" || controller.submissionId != null;

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus step heading on navigation
  useEffect(() => {
    stepHeadingRef.current?.focus();
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

  return (
    <>
      {mode.kind === "edit" ? <DraftResumeToast /> : null}
      <HideBottomTabBarWhileMounted />
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <WizardStepper
                activeIndex={stepIndex}
                maxReachableIndex={maxReachableIndex}
                onStepClick={(index) => {
                  if (index <= maxReachableIndex) goToStep(index);
                }}
                onPrev={handleBack}
                onNext={() => void handleNext()}
                canGoPrev={stepIndex > 0}
                canGoNext={!isLastStep}
              />
            </div>
            <WizardHeaderActions isSubmitting={isSubmitting} onFinishLater={handleFinishLater} />
          </div>

          {currentStep ? (
            <h2
              id="submission-wizard-step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-headline text-xl text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
                  submitForReview: () => void submitForReview(),
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
