"use client";

import type { ReviewStepProps } from "@/components/dashboard/submission-wizard/step-props";
import { type WIZARD_STEPS, wizardStepIndex } from "@/lib/forms/submission/step-validation";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import type { ItemSubmissionFormValues } from "@auction/validators";

function formatProvenance(values: ItemSubmissionFormValues): string {
  if (values.provenance.length === 0) return "—";
  return values.provenance.map((e) => [e.period, e.note].filter(Boolean).join(" — ")).join("; ");
}

function formatExhibitions(values: ItemSubmissionFormValues): string {
  if (values.exhibitions.length === 0) return "—";
  return values.exhibitions
    .map((e) => [e.year, e.venue, e.note].filter(Boolean).join(" — "))
    .join("; ");
}

export function ReviewStep({
  form,
  isSubmitting,
  onJumpTo,
  canSubmitForReview,
  onSaveDraft,
  onSubmitForReview,
}: ReviewStepProps) {
  const v = form.getValues();
  const imageWarning = v.images.length < 1;

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
      body: `${formatProvenance(v)} / ${formatExhibitions(v)}`,
    },
    {
      stepId: "pricing",
      title: "Pricing & notes",
      body: [
        v.askingPrice ? `Asking £${v.askingPrice}` : null,
        v.reservePrice ? `Reserve £${v.reservePrice}` : null,
        v.conditionSelfReport ? "Condition noted" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];

  return (
    <div className="space-y-6" data-testid="submission-wizard-step-review">
      <p className="font-body text-sm text-on-surface-variant">
        Check everything before saving or submitting. Specialists review submitted items before
        cataloguing.
      </p>

      {imageWarning ? (
        <Surface variant="quiet" padding="md" className="border-primary/30 bg-primary/5">
          <p className="font-body text-sm text-on-surface">
            Add at least one photo before you submit for review. You can still save a draft now.
          </p>
        </Surface>
      ) : null}

      <ul className="space-y-3">
        {sections.map((section) => (
          <li key={section.stepId}>
            <Surface
              variant="quiet"
              padding="md"
              className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-headline text-sm font-semibold text-on-surface">
                  {section.title}
                </h3>
                <p className="font-body text-sm text-on-surface-variant">{section.body || "—"}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs uppercase tracking-wider"
                onClick={() => onJumpTo(wizardStepIndex(section.stepId))}
              >
                Edit
              </Button>
            </Surface>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onSaveDraft}>
          {isSubmitting ? "Saving…" : "Save draft"}
        </Button>
        {canSubmitForReview ? (
          <Button type="button" variant="cta" disabled={isSubmitting} onClick={onSubmitForReview}>
            {isSubmitting ? "Submitting…" : "Save and submit for review"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
