"use client";

import { StaffMoneyField, StaffPercentField } from "@/components/admin/forms/staff-form-fields";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { FieldRow, FormSection } from "@auction/staff-ui";
import type { UseFormReturn } from "react-hook-form";
import { LOT_FORM_ID, LOT_MONEY_FIELDS, lotFieldProps } from "../../lot-field-spec";

type PricingKey = "startingPrice" | "reservePrice" | "buyNowPrice" | "buyerPremiumRate";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  fields: Pick<Record<LotCatalogueFieldKey, FieldSpec>, PricingKey>;
};

const ORDER: readonly PricingKey[] = [
  "startingPrice",
  "reservePrice",
  "buyNowPrice",
  "buyerPremiumRate",
];

export function CataloguePricingSection({ form, fields }: Props) {
  const visible = ORDER.filter((key) => fields[key].visible);
  if (visible.length === 0) return null;
  return (
    <FormSection
      title="Pricing"
      description="The opening amount, the reserve and the buyer's premium."
    >
      <FieldRow>
        {visible.map((key) =>
          LOT_MONEY_FIELDS.has(key) ? (
            <StaffMoneyField
              key={key}
              control={form.control}
              name={key}
              formId={LOT_FORM_ID}
              {...lotFieldProps(fields[key])}
            />
          ) : (
            <StaffPercentField
              key={key}
              control={form.control}
              name={key}
              formId={LOT_FORM_ID}
              {...(fields[key].placeholder ? { placeholder: fields[key].placeholder } : {})}
              {...lotFieldProps(fields[key])}
            />
          ),
        )}
      </FieldRow>
    </FormSection>
  );
}
