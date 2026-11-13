"use client";

import { StaffMoneyField, StaffPercentField } from "@/components/admin/forms/staff-form-fields";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import { lotPremiumFieldView } from "@/lib/admin/lot-catalogue/lot-premium-field";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { FieldRow, FormSection, KeyValueList, Notice, StaffButton } from "@auction/staff-ui";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { LOT_FORM_ID, lotFieldProps } from "../../lot-field-spec";

type PricingKey = "startingPrice" | "reservePrice" | "buyNowPrice" | "buyerPremiumRate";
type MoneyKey = Exclude<PricingKey, "buyerPremiumRate">;

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  fields: Pick<Record<LotCatalogueFieldKey, FieldSpec>, PricingKey>;
  /** The chosen sale's premium in words; `null` before a sale is chosen. */
  salePremium?: string | null;
};

const MONEY_ORDER: readonly MoneyKey[] = ["startingPrice", "reservePrice", "buyNowPrice"];

/**
 * The lot's buyer's premium: the sale's, unless staff set a different one for this lot. An
 * override is never silent: the form says the lot has its own premium and offers the reset.
 */
function LotPremiumField({
  form,
  spec,
  salePremium,
}: {
  form: UseFormReturn<AdminLotFormValues>;
  spec: FieldSpec;
  salePremium: string | null;
}) {
  const rate = form.watch("buyerPremiumRate") ?? "";
  const [overriding, setOverriding] = useState(rate.trim() !== "");
  const view = lotPremiumFieldView({ salePremium, lotRate: rate });

  if (!overriding) {
    return (
      <div className="flex flex-col gap-2">
        <KeyValueList items={[{ label: "Buyer's premium", value: view.usesSaleLine }]} />
        <div>
          <StaffButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOverriding(true)}
          >
            Set a different premium for this lot
          </StaffButton>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <StaffPercentField
        control={form.control}
        name="buyerPremiumRate"
        formId={LOT_FORM_ID}
        label="This lot's buyer's premium"
        description="Charged on the whole hammer instead of the sale's premium."
        {...(spec.placeholder ? { placeholder: spec.placeholder } : {})}
      />
      <Notice
        tone="warning"
        title="This lot has its own premium"
        actions={
          <StaffButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              form.setValue("buyerPremiumRate", "", { shouldDirty: true, shouldValidate: true });
              setOverriding(false);
            }}
          >
            Use the sale's premium
          </StaffButton>
        }
      >
        {view.overrideNote}
      </Notice>
    </div>
  );
}

export function CataloguePricingSection({ form, fields, salePremium = null }: Props) {
  const visibleMoney = MONEY_ORDER.filter((key) => fields[key].visible);
  const showPremium = fields.buyerPremiumRate.visible;
  if (visibleMoney.length === 0 && !showPremium) return null;
  return (
    <FormSection
      title="Pricing"
      description="The opening amount, the reserve and the buyer's premium."
    >
      {visibleMoney.length > 0 ? (
        <FieldRow>
          {visibleMoney.map((key) => (
            <StaffMoneyField
              key={key}
              control={form.control}
              name={key}
              formId={LOT_FORM_ID}
              {...lotFieldProps(fields[key])}
            />
          ))}
        </FieldRow>
      ) : null}
      {showPremium ? (
        <LotPremiumField form={form} spec={fields.buyerPremiumRate} salePremium={salePremium} />
      ) : null}
    </FormSection>
  );
}
