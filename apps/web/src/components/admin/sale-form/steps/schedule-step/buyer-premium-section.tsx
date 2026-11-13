import {
  StaffMoneyField,
  StaffPercentField,
  StaffRadioField,
} from "@/components/admin/forms/staff-form-fields";
import {
  type AdminSaleFormValues,
  type SaleBuyerPremiumMode,
  standardBuyerPremiumTierRows,
} from "@/lib/forms/schemas/admin-sale-form";
import { FieldRow, FormSection, KeyValueList, ListEditor, Notice } from "@auction/staff-ui";
import { STANDARD_BUYER_PREMIUM, describeBuyerPremium } from "@auction/validators";
import type {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormReturn,
} from "react-hook-form";
import { SALE_FORM_ID } from "../../sale-form-id";
import type { TierPreview } from "./types";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  fields: FieldArrayWithId<AdminSaleFormValues, "buyerPremiumTiers", "id">[];
  append: UseFieldArrayAppend<AdminSaleFormValues, "buyerPremiumTiers">;
  remove: UseFieldArrayRemove;
  tierBandPreview: TierPreview;
  /** The sale syncs to ATG, which takes a single flat rate — staff see a note to that effect. */
  syncsToAtg?: boolean | undefined;
};

const STANDARD_TERMS = describeBuyerPremium(STANDARD_BUYER_PREMIUM);

export const BUYER_PREMIUM_MODE_OPTIONS: ReadonlyArray<{
  value: SaleBuyerPremiumMode;
  label: string;
  description: string;
}> = [
  {
    value: "standard",
    label: `Standard: ${STANDARD_TERMS}`,
    description: "The premium in the Conditions of Sale. Use it unless the sale has agreed terms.",
  },
  {
    value: "flat",
    label: "Flat rate",
    description: "One rate on the whole hammer price.",
  },
  {
    value: "bands",
    label: "Custom bands",
    description: "Each rate is charged on the part of the hammer inside its band.",
  },
];

/**
 * The buyer's premium every lot in the sale charges unless a lot has its own: the standard
 * premium, one flat rate, or bands charged slice by slice. A worked example shows what the
 * choice charges. Fixed once the sale is published.
 */
export function BuyerPremiumSection({
  form,
  isDraft,
  fields,
  append,
  remove,
  tierBandPreview,
  syncsToAtg = false,
}: Props) {
  const f = { control: form.control, formId: SALE_FORM_ID, disabled: !isDraft } as const;
  const mode = form.watch("buyerPremiumMode");
  return (
    <FormSection
      title="Buyer's premium"
      description="Charged to the buyer on top of the hammer price. Fixed once the sale is published."
    >
      {syncsToAtg ? (
        <Notice tone="info" title="This sale syncs to ATG">
          ATG takes one flat rate for the whole hammer, so a sale with bands cannot sync. Choose a
          flat rate for the rate ATG should charge.
        </Notice>
      ) : null}
      <StaffRadioField<AdminSaleFormValues, SaleBuyerPremiumMode>
        {...f}
        name="buyerPremiumMode"
        label="Premium"
        options={BUYER_PREMIUM_MODE_OPTIONS}
        onChanged={(next) => {
          // Custom bands start from the standard ones, so staff edit rather than retype them.
          if (next === "bands" && fields.length === 0) append(standardBuyerPremiumTierRows());
        }}
      />
      {mode === "flat" ? (
        <StaffPercentField
          {...f}
          name="buyerPremiumRate"
          label="Flat rate"
          placeholder="15"
          description="Charged on the whole hammer price."
        />
      ) : null}
      {mode === "bands" ? (
        <ListEditor
          items={fields}
          getKey={(item) => item.id}
          itemLabel={(index) => `band ${index + 1}`}
          addLabel="Add band"
          emptyText="No bands yet. Add the first band, which starts at £0."
          max={16}
          disabled={!isDraft}
          onAdd={() => append({ hammerThresholdMajor: fields.length === 0 ? "0" : "", rate: "" })}
          onRemove={(index) => remove(index)}
          renderItem={(_item, index) => (
            <FieldRow>
              {index === 0 ? (
                <KeyValueList items={[{ label: "From hammer", value: "£0.00", numeric: true }]} />
              ) : (
                <StaffMoneyField
                  {...f}
                  name={`buyerPremiumTiers.${index}.hammerThresholdMajor`}
                  label="From hammer"
                />
              )}
              <StaffPercentField
                {...f}
                name={`buyerPremiumTiers.${index}.rate`}
                label="Rate"
                placeholder="15"
              />
            </FieldRow>
          )}
        />
      ) : null}
      {/* A persistent status region: it announces the worked example as it changes, and keeps a
          line here when the bands are not yet valid instead of vanishing silently. */}
      <Notice
        tone="info"
        title={tierBandPreview.ok ? `Buyer's premium: ${tierBandPreview.terms}` : "Buyer's premium"}
      >
        {tierBandPreview.ok
          ? `${tierBandPreview.example}.`
          : mode === "bands"
            ? "Fix the bands to see an example."
            : "Enter a flat rate to see an example."}
      </Notice>
    </FormSection>
  );
}
