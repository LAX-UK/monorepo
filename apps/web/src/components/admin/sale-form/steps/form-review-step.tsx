"use client";

import {
  WizardFormReviewSection,
  WizardReviewRow,
} from "@/components/admin/admin-form-wizard/wizard-form-review-section";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { formatDateTime } from "@/lib/ui/format";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  onEditStep: (stepIndex: number) => void;
};

export function SaleFormReviewStep({ form, onEditStep }: Props) {
  const values = form.getValues();
  const startLabel = values.startTime ? formatDateTime(new Date(values.startTime)) : "—";
  const endLabel = values.endTime ? formatDateTime(new Date(values.endTime)) : "—";

  return (
    <div className="space-y-6">
      <WizardFormReviewSection title="Identity" onEdit={() => onEditStep(0)}>
        <WizardReviewRow label="Title" value={values.title} />
        <WizardReviewRow label="Category" value={values.categoryId ? "Selected" : "—"} />
        <WizardReviewRow label="Cover images" value={String(values.coverImages?.length ?? 0)} />
      </WizardFormReviewSection>

      <WizardFormReviewSection title="Schedule" onEdit={() => onEditStep(1)}>
        <WizardReviewRow label="Delivery" value={values.deliveryMode} />
        <WizardReviewRow label="Starts" value={startLabel} />
        <WizardReviewRow label="Ends" value={endLabel} />
        <WizardReviewRow label="Location" value={values.locationName?.trim() || "—"} />
      </WizardFormReviewSection>

      <WizardFormReviewSection title="Documents" onEdit={() => onEditStep(2)}>
        <WizardReviewRow
          label="Terms"
          value={
            values.terms?.trim()
              ? values.terms.trim().length > 80
                ? `${values.terms.trim().slice(0, 80)}…`
                : values.terms.trim()
              : "—"
          }
        />
      </WizardFormReviewSection>
    </div>
  );
}
