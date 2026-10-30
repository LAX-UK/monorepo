"use client";

import { SellerAccountStep } from "@/components/dashboard/seller/seller-account-step";
import { SubmissionWizardView } from "@/components/dashboard/submission-wizard/submission-wizard";
import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import { wizardStepIndex } from "@/lib/forms/submission/step-validation";
import { useSubmissionWizardController } from "@/lib/forms/submission/use-submission-wizard-controller";
import { sendToSpecialistsLabel } from "@/lib/seller/sell-flow";
import type { SellerAccountChoice, SellerAccountOption } from "@/lib/seller/seller-account-options";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { useEffect, useRef, useState } from "react";

type Props = {
  categories: SubmissionCategoryOption[];
  initialValues?: ItemSubmissionFormValues;
  choice: SellerAccountChoice;
  registerHref: string;
};

/** "Selling as" at the top of Check and send, with the way back to change it. */
function SellingAsSummary({
  option,
  onChange,
}: {
  option: SellerAccountOption;
  onChange: (() => void) | null;
}) {
  return (
    <section
      aria-labelledby="selling-as-summary"
      className="flex items-start justify-between gap-4 rounded-lax-card border border-lax-line bg-lax-surface p-5"
    >
      <div className="min-w-0">
        <h3 id="selling-as-summary" className="text-lax-16 font-semibold text-lax-fg">
          Selling as
        </h3>
        <p className="mt-1 text-lax-14 text-lax-fg">
          {option.kind === "personal" ? `${option.name}, your personal account` : option.name}
        </p>
        {option.submitBlockedReason ? (
          <p className="mt-1 text-lax-13 text-lax-muted">{option.submitBlockedReason}</p>
        ) : null}
      </div>
      {onChange ? (
        <button
          type="button"
          onClick={onChange}
          className="shrink-0 text-lax-14 font-medium text-lax-fg underline underline-offset-4 lax-focus"
        >
          Change<span className="sr-only"> who is selling</span>
        </button>
      ) : null}
    </section>
  );
}

/**
 * "Sell a work": who is selling first, when the person has a choice (it decides who is paid,
 * who can change it and whose fees apply), then the work with the same form and checks as every
 * submission, ending in Check and send. The draft is saved as it goes, so it can be finished
 * later from Consignments.
 */
export function SellWithLaxFlow({ categories, initialValues, choice, registerHref }: Props) {
  const hasChoice = choice.options.length > 1;
  const [phase, setPhase] = useState<"seller" | "work">(hasChoice ? "seller" : "work");
  const [accountId, setAccountId] = useState<string | null>(choice.defaultId);
  const [cameBack, setCameBack] = useState(false);
  const controller = useSubmissionWizardController({ kind: "create" }, initialValues, {
    accountScope: () => ({ legalEntityId: accountId }),
  });
  const busy = controller.isSubmitting || controller.autosaveStatus === "saving";
  const sellerRef = useRef<HTMLDivElement>(null);
  const selected =
    choice.options.find((option) => option.id === accountId) ?? choice.options[0] ?? null;
  const blocked = selected !== null && !selected.canSubmit;

  // Returning to "Selling as" moves focus to it, without a ring: it is not a control.
  useEffect(() => {
    if (phase !== "seller" || !cameBack) return;
    sellerRef.current?.focus({ preventScroll: true });
    sellerRef.current?.scrollIntoView({ block: "start" });
  }, [phase, cameBack]);

  if (phase === "seller") {
    return (
      <div ref={sellerRef} tabIndex={-1} className="space-y-6 outline-none">
        <SellerAccountStep
          options={choice.options}
          selectedId={accountId}
          onSelect={setAccountId}
          registerHref={registerHref}
          busy={busy}
          onContinue={() => setPhase("work")}
        />
      </div>
    );
  }

  return (
    <SubmissionWizardView
      mode={{ kind: "create" }}
      categories={categories}
      controller={controller}
      // Coming back from "Selling as" reopens Check and send.
      {...(cameBack ? { initialStepIndex: wizardStepIndex("review") } : {})}
      primaryAction={
        blocked
          ? { label: "Save as draft", onActivate: () => void controller.saveDraft() }
          : {
              label: sendToSpecialistsLabel(selected),
              onActivate: () => void controller.submitForReview(),
            }
      }
      reviewLead={
        selected ? (
          <SellingAsSummary
            option={selected}
            onChange={
              hasChoice
                ? () => {
                    setCameBack(true);
                    setPhase("seller");
                  }
                : null
            }
          />
        ) : null
      }
    />
  );
}
