import { StaffMoneyField, StaffPercentField } from "@/components/admin/forms/staff-form-fields";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { formatMoney } from "@/lib/ui/format";
import { FieldRow, FormSection, KeyValueList, ListEditor, Notice } from "@auction/staff-ui";
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
};

/**
 * The buyer's premium: one flat rate, or bands where the rate for the whole hammer is the band
 * whose threshold is the highest still at or below it. The first band starts at £0.
 */
export function BuyerPremiumSection({
  form,
  isDraft,
  fields,
  append,
  remove,
  tierBandPreview,
}: Props) {
  const f = { control: form.control, formId: SALE_FORM_ID, disabled: !isDraft } as const;
  return (
    <FormSection
      title="Buyer's premium"
      description="A flat rate, or bands by hammer price. Fixed once the sale is published."
    >
      <StaffPercentField
        {...f}
        name="buyerPremiumRate"
        label="Flat rate"
        optional
        placeholder="25"
        description="Charged on the hammer price when there are no bands."
      />
      <ListEditor
        items={fields}
        getKey={(item) => item.id}
        itemLabel={(index) => `band ${index + 1}`}
        addLabel={fields.length === 0 ? "Add bands" : "Add band"}
        emptyText="No bands: the flat rate applies to every hammer price."
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
      {tierBandPreview.ok ? (
        <Notice
          tone="info"
          title={`Example with ${tierBandPreview.kind === "tiered" ? "these bands" : "the flat rate"}`}
        >
          {formatMoney(tierBandPreview.at250k.hammer)} hammer → buyer premium{" "}
          {formatMoney(tierBandPreview.at250k.premium)}.{" "}
          {formatMoney(tierBandPreview.at600k.hammer)} hammer → premium{" "}
          {formatMoney(tierBandPreview.at600k.premium)}.
        </Notice>
      ) : null}
    </FormSection>
  );
}
