"use client";

import {
  StaffEnumField,
  StaffTextAreaField,
  StaffTextField,
} from "@/components/admin/forms/staff-form-fields";
import { LOT_AUCTION_TYPE_DESCRIPTIONS } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type-presentation";
import { FormSection } from "@auction/staff-ui";
import type { LotAuctionType } from "@auction/types";
import type { UseFormReturn } from "react-hook-form";
import { LOT_FORM_ID } from "../lot-field-spec";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  auctionTypeOptions: readonly LotAuctionType[];
  englishOnlyAuctionsLocked: boolean;
  /** Clears catalogue fields that do not apply after an explicit lot-type change. */
  onAuctionTypeChange?: (previous: LotAuctionType, next: LotAuctionType) => void;
};

export function LotIdentityStep({
  form,
  auctionTypeOptions,
  englishOnlyAuctionsLocked,
  onAuctionTypeChange,
}: Props) {
  const auctionType = form.watch("auctionType") as LotAuctionType | undefined;
  return (
    <FormSection
      title="Identity"
      description="What bidders see first: the title, the description and how the lot is sold."
    >
      <StaffTextField control={form.control} name="title" formId={LOT_FORM_ID} label="Title" />
      <StaffTextAreaField
        control={form.control}
        name="description"
        formId={LOT_FORM_ID}
        label="Description"
        rows={5}
      />
      <StaffEnumField<AdminLotFormValues, LotAuctionType>
        control={form.control}
        name="auctionType"
        formId={LOT_FORM_ID}
        label="Lot type"
        description={
          englishOnlyAuctionsLocked
            ? "Only English auctions can be created while English-only mode is on."
            : auctionType
              ? LOT_AUCTION_TYPE_DESCRIPTIONS[auctionType]
              : undefined
        }
        options={auctionTypeOptions.map((type) => ({
          value: type,
          label: lotAuctionTypeLabel(type),
          description: LOT_AUCTION_TYPE_DESCRIPTIONS[type],
        }))}
        {...(onAuctionTypeChange
          ? {
              onChanged: (next: LotAuctionType, previous: LotAuctionType | null) => {
                if (previous) onAuctionTypeChange(previous, next);
              },
            }
          : {})}
      />
    </FormSection>
  );
}
