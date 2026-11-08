"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import {
  REGION_FIELD_LABELS,
  type RegionFormValues,
  checkRegionForm,
  regionFormValues,
} from "@/lib/delivery-regions";
import type { saveDeliveryRegion } from "@/server/application/delivery-regions-actions.server";
import type { AdminDeliveryRegions, DeliveryRegionView } from "@auction/shop-contracts";
import type { DeliveryRegionField } from "@auction/shop-domain";
import {
  ChoiceRow,
  Field,
  FormErrorSummary,
  MoneyInput,
  Notice,
  StaffRadio,
  StaffRadioGroup,
  TextInput,
} from "@auction/staff-ui";
import { useId, useState } from "react";

const DAY_FIELDS = [
  ["standardMinDays", "standardMin"],
  ["standardMaxDays", "standardMax"],
  ["specialistMinDays", "specialistMin"],
  ["specialistMaxDays", "specialistMax"],
] as const satisfies readonly (readonly [DeliveryRegionField, keyof RegionFormValues])[];

/**
 * Change one region's lead times and price. Two or more fields, so a failed save shows a summary
 * at the top and the sentence again beside each field. The price is a quote unless a fixed
 * amount is chosen; the UK's is set in checkout, so it is shown and not editable.
 */
export function RegionDialog({
  region,
  open,
  onOpenChange,
  save,
  onSaved,
}: {
  region: DeliveryRegionView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  save: typeof saveDeliveryRegion;
  onSaved: (regions: AdminDeliveryRegions) => void;
}) {
  const action = useAdminAction();
  const baseId = useId();
  const fieldId = (field: DeliveryRegionField) => `${baseId}-${field}`;
  const [values, setValues] = useState<RegionFormValues>(() => regionFormValues(region));
  const [submits, setSubmits] = useState(0);
  const checked = checkRegionForm(region.id, values);
  const errors = submits > 0 && !checked.ok ? checked.errors : {};
  const priceLocked = region.id === "uk";
  const set = <K extends keyof RegionFormValues>(key: K, value: RegionFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const ok = await action.run(
      async () => {
        const result = await save({
          id: region.id,
          ...checked.body,
          idempotencyKey: action.idempotencyKey,
        });
        if (result.ok) onSaved(result.data);
        return result;
      },
      `${region.name} delivery saved`,
      "change delivery regions",
    );
    if (ok) onOpenChange(false);
  };

  const summary = (Object.keys(errors) as DeliveryRegionField[]).map((field) => ({
    fieldId: fieldId(field),
    message: `${REGION_FIELD_LABELS[field]}: ${errors[field]}`,
  }));

  return (
    <>
      <StaffFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Edit ${region.name}`}
        description="Lead times are working days from dispatch."
        submitLabel="Save region"
        pending={action.pending}
        onSubmit={() => void submit()}
        size="md"
      >
        <FormErrorSummary focusKey={submits} errors={summary} />
        {action.error}
        {(["standard", "specialist"] as const).map((kind) => (
          <fieldset key={kind} className="flex flex-col gap-2">
            <legend className="mb-1 text-staff-sm font-medium text-staff-fg">
              {kind === "standard" ? "Standard delivery" : "Specialist delivery"}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {DAY_FIELDS.filter(([field]) => field.startsWith(kind)).map(([field, key]) => (
                <Field
                  key={field}
                  id={fieldId(field)}
                  label={field.endsWith("MinDays") ? "Shortest, days" : "Longest, days"}
                  error={errors[field]}
                >
                  <TextInput
                    inputMode="numeric"
                    autoComplete="off"
                    className="tabular-nums"
                    value={values[key] as string}
                    onChange={(event) => set(key, event.target.value as never)}
                  />
                </Field>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-staff-sm font-medium text-staff-fg">Price</legend>
          {priceLocked ? (
            <Notice
              tone="info"
              title="UK delivery is charged at its fixed price in checkout, so it can't be changed here yet."
            />
          ) : (
            <>
              <StaffRadioGroup
                aria-label="How delivery is priced"
                value={values.priceMode}
                onValueChange={(mode) => set("priceMode", mode as RegionFormValues["priceMode"])}
              >
                {(
                  [
                    ["quote", "Quote each order", "Staff send a price for each delivery."],
                    ["fixed", "Fixed price", "One price for every delivery to this region."],
                  ] as const
                ).map(([mode, label, description]) => (
                  <ChoiceRow
                    key={mode}
                    htmlFor={`${baseId}-${mode}`}
                    control={<StaffRadio id={`${baseId}-${mode}`} value={mode} />}
                    label={label}
                    description={description}
                  />
                ))}
              </StaffRadioGroup>
              {values.priceMode === "fixed" ? (
                <Field id={fieldId("fixedPricePence")} label="Price" error={errors.fixedPricePence}>
                  <MoneyInput
                    value={values.pricePence}
                    onValueChange={(pence) => set("pricePence", pence)}
                  />
                </Field>
              ) : null}
            </>
          )}
        </fieldset>
      </StaffFormDialog>
      {action.stepUpDialog}
    </>
  );
}
