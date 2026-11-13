"use client";

import {
  StaffMoneyField,
  StaffPercentField,
  staffFieldId,
} from "@/components/admin/forms/staff-form-fields";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import {
  LOT_PREMIUM_FIELD_DESCRIPTION,
  LOT_PREMIUM_FIELD_PLACEHOLDER,
  lotPremiumFieldView,
} from "@/lib/admin/lot-catalogue/lot-premium-field";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { Field, FieldRow, FormSection, Notice, StaffButton } from "@auction/staff-ui";
import { useEffect, useState } from "react";
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
 * override is never silent: once the field holds a rate, the form says the lot has its own
 * premium and offers the reset. A blank field saves nothing, so the lot keeps the sale's.
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
  // Set when staff open the field, so it takes focus once it is drawn (not on first load).
  const [focusField, setFocusField] = useState(false);
  const view = lotPremiumFieldView({ salePremium, lotRate: rate });
  const usesSaleId = `${LOT_FORM_ID}-buyerPremiumRate-uses-sale`;

  useEffect(() => {
    if (!overriding || !focusField) return;
    document.getElementById(staffFieldId(LOT_FORM_ID, "buyerPremiumRate"))?.focus();
    setFocusField(false);
  }, [overriding, focusField]);

  if (!overriding) {
    return (
      <div className="flex flex-col gap-2">
        <Field id={usesSaleId} label={spec.label}>
          <output id={usesSaleId} className="text-lax-ui text-lax-fg">
            {view.usesSaleLine}
          </output>
        </Field>
        <div>
          <StaffButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setOverriding(true);
              setFocusField(true);
            }}
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
        description={LOT_PREMIUM_FIELD_DESCRIPTION}
        optional
        placeholder={LOT_PREMIUM_FIELD_PLACEHOLDER}
      />
      {view.overrideNotice ? (
        <Notice
          tone="warning"
          title={view.overrideNotice.title}
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
          {view.overrideNotice.body}
        </Notice>
      ) : null}
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
