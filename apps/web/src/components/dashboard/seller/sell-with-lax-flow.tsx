"use client";

import { FlowStepIndicator } from "@/components/dashboard/seller/flow-step-indicator";
import { SellerAccountStep } from "@/components/dashboard/seller/seller-account-step";
import { SubmissionWizardView } from "@/components/dashboard/submission-wizard/submission-wizard";
import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import { allWizardFieldPaths, wizardStepIndex } from "@/lib/forms/submission/step-validation";
import { useSubmissionWizardController } from "@/lib/forms/submission/use-submission-wizard-controller";
import type { SellerAccountChoice } from "@/lib/seller/seller-account-options";
import { notify } from "@/lib/ui/notify";
import { evaluateSubmissionQuality } from "@auction/domain";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { useCallback, useEffect, useRef, useState } from "react";

const STEPS = ["The work", "Who is selling?"] as const;

type Props = {
  categories: SubmissionCategoryOption[];
  initialValues?: ItemSubmissionFormValues;
  choice: SellerAccountChoice;
  registerHref: string;
};

/**
 * "Sell with LAX" in two steps: the work, using the same form and checks as every submission,
 * then who is selling. The submission is created for the account chosen in the second step.
 */
export function SellWithLaxFlow({ categories, initialValues, choice, registerHref }: Props) {
  const [step, setStep] = useState<0 | 1>(0);
  const [accountId, setAccountId] = useState<string | null>(choice.defaultId);
  const controller = useSubmissionWizardController({ kind: "create" }, initialValues, {
    accountScope: () => ({ legalEntityId: accountId }),
  });
  const { form } = controller;
  const busy = controller.isSubmitting || controller.autosaveStatus === "saving";
  const headingRef = useRef<HTMLDivElement>(null);
  const movedStep = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: move focus when the step changes
  useEffect(() => {
    if (!movedStep.current) return;
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "start" });
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

  const backToWork = useCallback(() => {
    movedStep.current = true;
    setStep(0);
  }, []);

  return (
    <div className="space-y-6">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <FlowStepIndicator steps={STEPS} current={step} />
      </div>
      {step === 0 ? (
        <SubmissionWizardView
          mode={{ kind: "create" }}
          categories={categories}
          controller={controller}
          // Coming back from step 2 reopens the review, not the first question.
          initialStepIndex={movedStep.current ? wizardStepIndex("review") : 0}
          primaryAction={{ label: "Continue", onActivate: continueToSeller }}
        />
      ) : (
        <SellerAccountStep
          options={choice.options}
          selectedId={accountId}
          onSelect={setAccountId}
          registerHref={registerHref}
          busy={busy}
          onBack={backToWork}
          onSubmit={() => void controller.submitForReview()}
          onSaveDraft={() => void controller.saveDraft()}
        />
      )}
    </div>
  );
}
