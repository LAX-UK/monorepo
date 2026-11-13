import {
  StaffMoneyField,
  StaffPercentField,
  StaffRadioField,
} from "@/components/admin/forms/staff-form-fields";
import {
  type AdminSaleFormValues,
  type SaleBuyerPremiumMode,
  buyerPremiumBandProblem,
  standardBuyerPremiumTierRows,
} from "@/lib/forms/schemas/admin-sale-form";
import {
  Field,
  FieldError,
  FieldRow,
  FormSection,
  ListEditor,
  Notice,
  formatGbp,
  parsePoundsToPence,
} from "@auction/staff-ui";
import { useState } from "react";
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

export const BUYER_PREMIUM_MODE_OPTIONS: ReadonlyArray<{
  value: SaleBuyerPremiumMode;
  label: string;
  description: string;
}> = [
  {
    // The terms themselves are in the example below, so they are not repeated here.
    value: "standard",
    label: "Standard",
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

/** What the example line says while there is no example to show. */
export function premiumExampleFallback(
  mode: SaleBuyerPremiumMode,
  preview: TierPreview,
): string | null {
  if (preview.ok) return null;
  if (mode !== "bands") return "Enter a flat rate to see an example.";
  return preview.reason === "incomplete"
    ? "Finish every band to see an example."
    : "Fix the bands to see an example.";
}

/** The note in band 1 after the band above it was removed and it now starts at £0. */
export function rebasedBandNote(previousStartMajor: string): string {
  const parsed = parsePoundsToPence(previousStartMajor);
  const from = parsed.ok ? formatGbp(parsed.pence) : null;
  return from
    ? `It started at ${from} before the band above it was removed. Check its rate.`
    : "The band above it was removed. Check its rate.";
}

/**
 * The buyer's premium every lot in the sale charges unless a lot has its own: the standard
 * premium, one flat rate, or bands charged slice by slice. A worked example shows what the
 * choice charges, once every band is complete. Fixed once the sale is published.
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
  const rows = form.watch("buyerPremiumTiers") ?? [];
  const { touchedFields, isSubmitted } = form.formState;
  // Set when band 1 is removed and the next band moves up to start at £0, so staff are told.
  const [rebasedFrom, setRebasedFrom] = useState<string | null>(null);
  const fallback = premiumExampleFallback(mode, tierBandPreview);

  const bandError = (index: number): string | null => {
    const row = rows[index];
    if (!row) return null;
    const touched = Boolean(touchedFields.buyerPremiumTiers?.[index]);
    return isSubmitted || touched ? buyerPremiumBandProblem(row, index) : null;
  };

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
        // The choice above already says the rate is charged on the whole hammer.
        <StaffPercentField {...f} name="buyerPremiumRate" label="Flat rate" placeholder="15" />
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
          onAdd={() => {
            setRebasedFrom(null);
            append({ hammerThresholdMajor: fields.length === 0 ? "0" : "", rate: "" });
          }}
          onRemove={(index) => {
            // Band 1 always starts at £0: when it goes, the next band moves up and starts at £0
            // too, which changes what it charges, so the form says so rather than doing it
            // silently.
            const next = index === 0 ? rows[1] : undefined;
            setRebasedFrom(next ? next.hammerThresholdMajor : null);
            remove(index);
            if (next) {
              form.setValue("buyerPremiumTiers.0.hammerThresholdMajor", "0", {
                shouldDirty: true,
              });
            }
          }}
          renderItem={(_item, index) => {
            const error = bandError(index);
            const errorId = `${SALE_FORM_ID}-band-${index + 1}-error`;
            const startId = `${SALE_FORM_ID}-band-1-from`;
            return (
              <>
                {index === 0 && rebasedFrom !== null ? (
                  <Notice tone="warning" title="Band 1 now starts at £0">
                    {rebasedBandNote(rebasedFrom)}
                  </Notice>
                ) : null}
                <FieldRow>
                  {index === 0 ? (
                    // Fixed at £0: shown in the same label and box rhythm as the field beside it.
                    <Field
                      id={startId}
                      label="From hammer"
                      description="Band 1 always starts at £0."
                    >
                      <output
                        id={startId}
                        className="flex h-lax-control-md items-center text-lax-14 tabular-nums text-lax-fg"
                      >
                        £0.00
                      </output>
                    </Field>
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
                {error ? <FieldError id={errorId}>{error}</FieldError> : null}
              </>
            );
          }}
        />
      ) : null}
      {/* A persistent status region: it announces the worked example as it changes, and keeps a
          line here when the bands are not yet complete instead of vanishing silently. */}
      <Notice
        tone="info"
        title={tierBandPreview.ok ? `Buyer's premium: ${tierBandPreview.terms}` : "Buyer's premium"}
      >
        {tierBandPreview.ok ? tierBandPreview.example : fallback}
      </Notice>
    </FormSection>
  );
}
