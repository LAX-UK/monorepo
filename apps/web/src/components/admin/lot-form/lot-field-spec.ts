import type { FieldSpec } from "@/lib/admin/lot-catalogue";

/** The lot form's DOM id prefix; each control's id is `lot-form-<field>`. */
export const LOT_FORM_ID = "lot-form";

/** A catalogue field's label, guidance and whether it is optional, for a kit field. */
export function lotFieldProps(spec: FieldSpec): {
  label: string;
  description?: string;
  optional: boolean;
} {
  return {
    label: spec.label,
    optional: !spec.required,
    ...(spec.helpText ? { description: spec.helpText } : {}),
  };
}

/** Amounts entered in pounds through the kit money input. */
export const LOT_MONEY_FIELDS = new Set([
  "startingPrice",
  "reservePrice",
  "buyNowPrice",
  "minBidIncrement",
  "autoBidStepMin",
  "autoBidStepMax",
  "dutchDecrementAmount",
]);
