"use client";

import {
  WizardFormReviewSection,
  WizardReviewRow,
} from "@/components/admin/admin-form-wizard/wizard-form-review-section";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { formatDateTime } from "@/lib/ui/format";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  onEditStep: (stepIndex: number) => void;
};

export function LotFormReviewStep({ form, onEditStep }: Props) {
  const values = form.getValues();
  const endLabel = values.endTime ? formatDateTime(new Date(values.endTime)) : "—";

  return (
    <div className="space-y-6">
      <WizardFormReviewSection title="Identity" onEdit={() => onEditStep(0)}>
        <WizardReviewRow label="Title" value={values.title} />
        <WizardReviewRow label="Auction type" value={values.auctionType} />
      </WizardFormReviewSection>

      <WizardFormReviewSection title="Sale & seller" onEdit={() => onEditStep(1)}>
        <WizardReviewRow label="Sale" value={values.saleId ? "Attached to sale" : "Standalone"} />
        <WizardReviewRow
          label="Seller"
          value={values.sellerDisplayName ?? (values.sellerLegalEntityId ? "Selected" : "—")}
        />
        <WizardReviewRow
          label="Lot number"
          value={values.lotNumber != null ? String(values.lotNumber) : "—"}
        />
      </WizardFormReviewSection>

      <WizardFormReviewSection title="Catalogue" onEdit={() => onEditStep(2)}>
        <WizardReviewRow
          label="Categories"
          value={values.categoryIds?.length ? `${values.categoryIds.length} selected` : "—"}
        />
        <WizardReviewRow label="Reserve" value={values.reservePrice?.trim() || "—"} />
        <WizardReviewRow label="Starting price" value={values.startingPrice?.trim() || "—"} />
        <WizardReviewRow label="Ends" value={endLabel} />
        <WizardReviewRow label="Images" value={String(values.images?.length ?? 0)} />
      </WizardFormReviewSection>
    </div>
  );
}
