"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { LotAuctionTypeChip } from "@/components/admin/lot-auction-type-chip";
import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import { LOT_AUCTION_TYPE_DESCRIPTIONS } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type-presentation";
import type { LotAuctionType } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import type { UseFormReturn } from "react-hook-form";

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
  return (
    <CatalogFormSection
      title="Identity"
      description="Public-facing title, description, and auction format."
      collapsible={false}
    >
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="mb-2 block">
              <LabelCaps>Title</LabelCaps>
            </FormLabel>
            <FormControl>
              <UnderlineInput placeholder="Lot title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="description" className="mb-2 block">
              <LabelCaps>Description</LabelCaps>
            </FormLabel>
            <FormControl>
              <Textarea id="description" rows={5} className="font-body text-sm" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="auctionType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <LabelCaps>Lot type</LabelCaps>
            </FormLabel>
            <RhfSelect
              value={field.value}
              onValueChange={(next) => {
                const previous = field.value as LotAuctionType;
                if (previous === next) return;
                field.onChange(next);
                onAuctionTypeChange?.(previous, next as LotAuctionType);
              }}
              onBlur={field.onBlur}
              options={auctionTypeOptions.map((t) => ({
                value: t,
                label: lotAuctionTypeLabel(t),
              }))}
              triggerClassName="w-full font-body text-sm"
            />
            {field.value ? (
              <div className="mt-2 flex flex-col gap-2">
                <LotAuctionTypeChip auctionType={field.value as LotAuctionType} />
                <p className="font-body text-xs text-on-surface-variant">
                  {LOT_AUCTION_TYPE_DESCRIPTIONS[field.value as LotAuctionType]}
                </p>
              </div>
            ) : null}
            {englishOnlyAuctionsLocked ? (
              <p className="mt-2 font-body text-xs text-on-surface-variant">
                English-only mode is on: new drafts use the English auction type. Legacy non-English
                lots still appear here until migrated.
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />
    </CatalogFormSection>
  );
}
