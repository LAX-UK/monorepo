"use client";

import { SellerAccountStep } from "@/components/dashboard/seller/seller-account-step";
import { SubmissionWizardView } from "@/components/dashboard/submission-wizard/submission-wizard";
import { WizardStepper } from "@/components/dashboard/submission-wizard/wizard-stepper";
import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import {
  WIZARD_STEP_COUNT,
  allWizardFieldPaths,
  wizardStepIndex,
} from "@/lib/forms/submission/step-validation";
import { useSubmissionWizardController } from "@/lib/forms/submission/use-submission-wizard-controller";
import type { SellerAccountChoice } from "@/lib/seller/seller-account-options";
import { notify } from "@/lib/ui/notify";
import { evaluateSubmissionQuality } from "@auction/domain";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { useCallback, useEffect, useRef, useState } from "react";

/** The flow's own last step, after the form's: one progress bar counts them all. */
const SELLER_STEP = [{ id: "seller", label: "Who is selling?" }] as const;

type Props = {
  categories: SubmissionCategoryOption[];
  initialValues?: ItemSubmissionFormValues;
  choice: SellerAccountChoice;
  registerHref: string;
};

/**
 * "Sell a work": the work, using the same form and checks as every submission, then who is
 * selling, as the last step of the same progress bar. The submission is created for the account
 * chosen in that step.
 */
export function SellWithLaxFlow({ categories, initialValues, choice, registerHref }: Props) {
  const [step, setStep] = useState<0 | 1>(0);
  /** The form step to reopen when coming back from "Who is selling?". */
  const [returnIndex, setReturnIndex] = useState(wizardStepIndex("review"));
  const [accountId, setAccountId] = useState<string | null>(choice.defaultId);
  const controller = useSubmissionWizardController({ kind: "create" }, initialValues, {
    accountScope: () => ({ legalEntityId: accountId }),
  });
  const { form } = controller;
  const busy = controller.isSubmitting || controller.autosaveStatus === "saving";
  const sellerRef = useRef<HTMLDivElement>(null);
  const movedStep = useRef(false);

  // Reaching "Who is selling?" moves focus to it, without a ring: it is not a control.
  useEffect(() => {
    if (step !== 1) return;
    sellerRef.current?.focus({ preventScroll: true });
    sellerRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  const continueToSeller = useCallback(() => {
    void (async () => {
      const valid = await form.trigger(allWizardFieldPaths(), { shouldFocus: true });
      const values = form.getValues();
      const quality = evaluateSubmissionQuality({
        title: values.title,
        images: values.images,
        description: values.description,
        provenance: values.provenance,
        categoryId: values.categoryIds[0] ?? "",
        categoryIds: values.categoryIds,
      });
      if (!valid || !quality.canSubmit) {
        notify.error("Add a title, a category and at least one photo first");
        return;
      }
      movedStep.current = true;
      setStep(1);
    })();
  }, [form]);

  const backToWork = useCallback((index: number = wizardStepIndex("review")) => {
    movedStep.current = true;
    setReturnIndex(index);
    setStep(0);
  }, []);

  return (
    <div className="space-y-6">
      {step === 0 ? (
        <SubmissionWizardView
          mode={{ kind: "create" }}
          categories={categories}
          controller={controller}
          // Coming back from "Who is selling?" reopens the review (or the step chosen in the bar).
          initialStepIndex={movedStep.current ? returnIndex : 0}
          primaryAction={{ label: "Continue", onActivate: continueToSeller }}
          trailingSteps={SELLER_STEP}
        />
      ) : (
        <div ref={sellerRef} tabIndex={-1} className="space-y-6 outline-none">
          <WizardStepper
            activeIndex={WIZARD_STEP_COUNT}
            maxReachableIndex={WIZARD_STEP_COUNT}
            onStepClick={(index) => {
              if (index < WIZARD_STEP_COUNT) backToWork(index);
            }}
            trailingSteps={SELLER_STEP}
          />
          <SellerAccountStep
            options={choice.options}
            selectedId={accountId}
            onSelect={setAccountId}
            registerHref={registerHref}
            busy={busy}
            onBack={() => backToWork()}
            onSubmit={() => void controller.submitForReview()}
            onSaveDraft={() => void controller.saveDraft()}
          />
        </div>
      )}
    </div>
  );
}
