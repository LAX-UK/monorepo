"use client";

import {
  StaffCheckboxField,
  StaffMoneyField,
  StaffTextField,
} from "@/components/admin/forms/staff-form-fields";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { FieldRow, FormSection } from "@auction/staff-ui";
import type { UseFormReturn } from "react-hook-form";
import { LOT_FORM_ID, LOT_MONEY_FIELDS, lotFieldProps } from "../../lot-field-spec";

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

const ORDER: readonly Exclude<BiddingFieldKey, "autoBidEnabled">[] = [
  "minBidIncrement",
  "autoBidStepMin",
  "autoBidStepMax",
  "autoBidStepPresetsCsv",
  "dutchDecrementAmount",
  "dutchDecrementIntervalMs",
];

export function CatalogueBiddingSection({ form, fields }: Props) {
  const visible = ORDER.filter((key) => fields[key].visible);
  const autoBid = fields.autoBidEnabled.visible;
  if (visible.length === 0 && !autoBid) return null;
  return (
    <FormSection
      title="Bidding rules"
      description="The bid increment, auto-bidding, and how this lot type's price moves."
    >
      {autoBid ? (
        <StaffCheckboxField
          control={form.control}
          name="autoBidEnabled"
          formId={LOT_FORM_ID}
          defaultChecked
          label={fields.autoBidEnabled.label}
          {...(fields.autoBidEnabled.helpText
            ? { description: fields.autoBidEnabled.helpText }
            : {})}
        />
      ) : null}
      {visible.length > 0 ? (
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
              <StaffTextField
                key={key}
                control={form.control}
                name={key}
                formId={LOT_FORM_ID}
                inputMode={key === "dutchDecrementIntervalMs" ? "numeric" : "text"}
                {...(fields[key].placeholder ? { placeholder: fields[key].placeholder } : {})}
                {...lotFieldProps(fields[key])}
              />
            ),
          )}
        </FieldRow>
      ) : null}
    </FormSection>
  );
}
