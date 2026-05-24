"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { UseFormReturn } from "react-hook-form";
import { CatalogueFieldHelp } from "./catalogue-field-help";

type BiddingFieldKey =
  | "minBidIncrement"
  | "autoBidEnabled"
  | "autoBidStepMin"
  | "autoBidStepMax"
  | "autoBidStepPresetsCsv"
  | "dutchDecrementAmount"
  | "dutchDecrementIntervalMs";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  fields: Pick<Record<LotCatalogueFieldKey, FieldSpec>, BiddingFieldKey>;
};

const FIELD_ORDER: BiddingFieldKey[] = [
  "minBidIncrement",
  "autoBidEnabled",
  "autoBidStepMin",
  "autoBidStepMax",
  "autoBidStepPresetsCsv",
  "dutchDecrementAmount",
  "dutchDecrementIntervalMs",
];

export function CatalogueBiddingSection({ form, fields }: Props) {
  const visibleKeys = FIELD_ORDER.filter((key) => fields[key].visible);

  if (visibleKeys.length === 0) return null;

  return (
    <CatalogFormSection
      title="Bidding rules"
      description="Increment, auto-bid policy, and type-specific bidding behaviour."
      collapsible={false}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {visibleKeys.map((key) => {
          const spec = fields[key];
          if (key === "autoBidEnabled") {
            return (
              <FormField
                key={key}
                control={form.control}
                name="autoBidEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 sm:col-span-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? true}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        <LabelCaps>{spec.label}</LabelCaps>
                      </FormLabel>
                      <CatalogueFieldHelp text={spec.helpText} />
                    </div>
                  </FormItem>
                )}
              />
            );
          }
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
                    <UnderlineInput
                      placeholder={spec.placeholder}
                      {...field}
                      value={field.value == null ? "" : String(field.value)}
                    />
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
