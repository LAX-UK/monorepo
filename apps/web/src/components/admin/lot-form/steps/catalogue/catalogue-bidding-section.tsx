"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { UseFormReturn } from "react-hook-form";
import { CatalogueFieldHelp } from "./catalogue-field-help";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  fields: Pick<
    Record<LotCatalogueFieldKey, FieldSpec>,
    "minBidIncrement" | "dutchDecrementAmount" | "dutchDecrementIntervalMs"
  >;
};

export function CatalogueBiddingSection({ form, fields }: Props) {
  const visibleKeys = (
    ["minBidIncrement", "dutchDecrementAmount", "dutchDecrementIntervalMs"] as const
  ).filter((key) => fields[key].visible);

  if (visibleKeys.length === 0) return null;

  return (
    <CatalogFormSection
      title="Bidding rules"
      description="Increment and type-specific bidding behaviour."
      collapsible={false}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {visibleKeys.map((key) => {
          const spec = fields[key];
          return (
            <FormField
              key={key}
              control={form.control}
              name={key}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>{spec.label}</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder={spec.placeholder} {...field} />
                  </FormControl>
                  <CatalogueFieldHelp text={spec.helpText} />
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
      </div>
    </CatalogFormSection>
  );
}
