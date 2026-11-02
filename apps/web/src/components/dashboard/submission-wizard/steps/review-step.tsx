"use client";

import type { ReviewStepProps } from "@/components/dashboard/submission-wizard/step-props";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney } from "@/lib/format-currency";
import { type WIZARD_STEPS, wizardStepIndex } from "@/lib/forms/submission/step-validation";
import {
  SPECIALIST_RESPONSE_PROMISE,
  SUBMISSION_AFTER_SUBMIT_HINTS,
  SUBMISSION_FINISH_LATER_LABEL,
  SUBMISSION_SUBMIT_LABEL,
} from "@/lib/marketing/sell-flow-copy";
import { evaluateSubmissionQuality } from "@auction/domain";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@auction/ui/components/accordion";
import { Button, Notice } from "@auction/ui/lax";
import type { ItemSubmissionFormValues } from "@auction/validators";
function formatProvenance(values: ItemSubmissionFormValues): string {
  if (values.provenance.length === 0) return "";
  return values.provenance.map((e) => [e.period, e.note].filter(Boolean).join(", ")).join("; ");
}

function formatExhibitions(values: ItemSubmissionFormValues): string {
  if (values.exhibitions.length === 0) return "";
  return values.exhibitions
    .map((e) => [e.year, e.venue, e.note].filter(Boolean).join(", "))
    .join("; ");
}

export function ReviewStep({
  form,
  isSubmitting,
  onJumpTo,
  canSubmitForReview,
  onFinishLater,
  onSubmitForReview,
  submitLabel = SUBMISSION_SUBMIT_LABEL,
  lead = null,
}: ReviewStepProps) {
  const v = form.getValues();
  const quality = evaluateSubmissionQuality({
    title: v.title,
    images: v.images,
    description: v.description,
    provenance: v.provenance,
    categoryId: v.categoryIds[0] ?? "",
    categoryIds: v.categoryIds,
  });
  const canSubmit = quality.canSubmit;
  const missing = quality.checks.filter((c) => c.severity === "required" && !c.ok);

  const sections: { stepId: (typeof WIZARD_STEPS)[number]["id"]; title: string; body: string }[] = [
    {
      stepId: "basics",
      title: "Basics",
      body: [v.title, `Categories: ${v.categoryIds.length}`, v.yearOfWork, v.edition]
        .filter(Boolean)
        .join(" · "),
    },
    {
      stepId: "details",
      title: "Details",
      body: [v.medium, v.dimensions, v.isSigned ? "Signed" : null, v.description]
        .filter(Boolean)
        .join(" · "),
    },
    {
      stepId: "photos",
      title: "Photos",
      body: `${v.images.length} image${v.images.length === 1 ? "" : "s"}`,
    },
    {
      stepId: "provenance",
      title: "Provenance & exhibitions",
      body: [formatProvenance(v), formatExhibitions(v)].filter(Boolean).join(" / "),
    },
    {
      stepId: "pricing",
      title: "Pricing & notes",
      body: [
        v.askingPrice ? `Asking ${formatMoney(v.askingPrice, PLATFORM_DEFAULT_CURRENCY)}` : null,
        v.reservePrice ? `Reserve ${formatMoney(v.reservePrice, PLATFORM_DEFAULT_CURRENCY)}` : null,
        v.conditionSelfReport ? "Condition noted" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];

  return (
    <div className="space-y-6" data-testid="submission-wizard-step-review">
      <p className="font-body text-sm text-on-surface-variant">
        Check your answers, then send them to our specialists. You can change anything before you
        send. {SPECIALIST_RESPONSE_PROMISE}
      </p>
      {lead}

      {!canSubmit ? (
        <Notice tone="warning" title="Complete these before you send">
          <ul className="list-inside list-disc">
            {missing.map((check) => (
              <li key={check.id}>{check.label}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <ul className="space-y-3">
        {sections.map((section) => (
          <li key={section.stepId}>
            <section
              aria-labelledby={`check-${section.stepId}`}
              className="flex items-start justify-between gap-4 rounded-lax-card border border-lax-line bg-lax-surface p-5"
            >
              <div className="min-w-0 flex-1">
                <h3
                  id={`check-${section.stepId}`}
                  className="text-lax-16 font-semibold text-lax-fg"
                >
                  {section.title}
                </h3>
                <p className="mt-1 text-lax-14 text-lax-muted">{section.body || "Not added yet"}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => onJumpTo(wizardStepIndex(section.stepId))}
              >
                Change<span className="sr-only"> {section.title.toLowerCase()}</span>
              </Button>
            </section>
          </li>
        ))}
      </ul>

      <Accordion type="single" collapsible className="border-border-hairline">
        <AccordionItem value="after-submit" className="border-border-hairline">
          <AccordionTrigger className="font-headline text-sm font-semibold text-on-surface hover:no-underline">
            What happens after you send
          </AccordionTrigger>
          <AccordionContent>
            <ul className="list-inside list-disc space-y-2 font-body text-sm text-on-surface-variant">
              {SUBMISSION_AFTER_SUBMIT_HINTS.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-col gap-3">
        {canSubmitForReview ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            loading={isSubmitting}
            onClick={onSubmitForReview}
            data-testid="wizard-submit-for-review"
            {...(canSubmit ? {} : { disabledReason: "Complete the items above first." })}
          >
            {isSubmitting ? "Sending…" : submitLabel}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
          onClick={onFinishLater}
          data-testid="wizard-finish-later-review"
        >
          {SUBMISSION_FINISH_LATER_LABEL}
        </Button>
      </div>
    </div>
  );
}
