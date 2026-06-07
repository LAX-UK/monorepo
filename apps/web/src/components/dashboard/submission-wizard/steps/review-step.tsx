"use client";

import type { ReviewStepProps } from "@/components/dashboard/submission-wizard/step-props";
import { type WIZARD_STEPS, wizardStepIndex } from "@/lib/forms/submission/step-validation";
import { evaluateSubmissionQuality } from "@auction/domain";
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
  const quality = evaluateSubmissionQuality({
    title: v.title,
    images: v.images,
    description: v.description,
    provenance: v.provenance,
    categoryId: v.categoryIds[0] ?? "",
    categoryIds: v.categoryIds,
  });
  const canSubmit = quality.canSubmit;
  const advisoryGaps = quality.checks.filter((c) => c.severity === "warning" && !c.ok);
  const advisoryChecks = quality.checks.filter((c) => c.severity === "warning");
  const qualityPercent =
    advisoryChecks.length === 0
      ? 100
      : Math.round((advisoryChecks.filter((c) => c.ok).length / advisoryChecks.length) * 100);

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

      {!canSubmit ? (
        <Surface variant="quiet" padding="md" className="border-primary/30 bg-primary/5">
          <p className="mb-2 font-body text-sm font-medium text-on-surface">
            Complete required items before submitting:
          </p>
          <ul className="list-inside list-disc space-y-1 font-body text-sm text-on-surface-variant">
            {quality.checks
              .filter((c) => c.severity === "required" && !c.ok)
              .map((c) => (
                <li key={c.id}>{c.label}</li>
              ))}
          </ul>
        </Surface>
      ) : null}

      <Surface variant="quiet" padding="md" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-headline text-sm font-semibold text-on-surface">Submission quality</p>
          <span className="font-label text-xs font-semibold uppercase tracking-wider text-primary">
            {qualityPercent}%
          </span>
        </div>
        {advisoryGaps.length > 0 ? (
          <ul className="list-inside list-disc space-y-1 font-body text-sm text-on-surface-variant">
            {advisoryGaps.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm text-on-surface-variant">
            Required fields are complete. Optional improvements above can strengthen your listing.
          </p>
        )}
      </Surface>

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
        {canSubmitForReview && canSubmit ? (
          <Button type="button" variant="cta" disabled={isSubmitting} onClick={onSubmitForReview}>
            {isSubmitting ? "Submitting…" : "Save and submit for review"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
