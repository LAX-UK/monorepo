"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import type { FieldErrors } from "@/lib/form-validation";
import {
  FRAME_OPTIONS,
  type FramingFormValues,
  GLAZING_OPTIONS,
  HANGING_OPTIONS,
  MOUNT_OPTIONS,
  framingFormDefaults,
  stillPlaceholder,
  validateFramingForm,
} from "@/lib/framing-form";
import {
  createFramingOption,
  saveFramingOption,
} from "@/server/application/framing-actions.server";
import type { FramingOption } from "@auction/shop-contracts";
import {
  FRAMING_BAND_CODES,
  FRAMING_NAME_MAX_LENGTH,
  type FramingBandCode,
  framingBandLabel,
} from "@auction/shop-domain";
import {
  ChoiceRow,
  EnumSelect,
  Field,
  FormErrorSummary,
  MoneyInput,
  Notice,
  StaffCheckbox,
  TextInput,
} from "@auction/staff-ui";
import { useId, useState } from "react";

const PRICE_FIELD = (band: FramingBandCode) => `price:${band}` as const;

/**
 * Adds a framing option, or edits one. The form mounts fresh each time it opens, so no old input
 * lingers. Staff see every problem at once, in a summary and against each field, and the same
 * rules run again on the server.
 */
export function FramingOptionDialog({
  option,
  onClose,
}: {
  /** The option being edited, or null to add one. */
  option: FramingOption | null;
  onClose: () => void;
}) {
  const action = useAdminAction();
  const base = useId();
  const id = (name: string) => `${base}-${name}`;
  const [values, setValues] = useState<FramingFormValues>(() => framingFormDefaults(option));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitCount, setSubmitCount] = useState(0);

  const placeholder = stillPlaceholder(option, values.prices);

  function change(patch: Partial<FramingFormValues>) {
    const next = { ...values, ...patch };
    // Placeholder prices cannot be offered, so the switch goes back off when they come back.
    if (stillPlaceholder(option, next.prices)) next.offered = false;
    setValues(next);
    // After a first attempt, fields are rechecked as they change.
    if (submitCount > 0) {
      const checked = validateFramingForm(next, option);
      setErrors(checked.ok ? {} : checked.errors);
    }
  }

  async function submit() {
    const checked = validateFramingForm(values, option);
    setSubmitCount((count) => count + 1);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    const payload = checked.value;
    const ok = await action.run(
      () =>
        option
          ? saveFramingOption({
              optionId: option.id,
              payload,
              expectedVersion: option.version,
              idempotencyKey: action.idempotencyKey,
            })
          : createFramingOption({ payload, idempotencyKey: action.idempotencyKey }),
      option ? "Framing saved" : "Framing option added",
      option ? "save this framing option" : "add this framing option",
    );
    if (ok) onClose();
  }

  const summary = [
    { field: "name", fieldId: id("name") },
    { field: "leadTimeMinDays", fieldId: id("lead-min") },
    { field: "leadTimeMaxDays", fieldId: id("lead-max") },
    ...FRAMING_BAND_CODES.map((band) => ({
      field: PRICE_FIELD(band),
      fieldId: id(`price-${band}`),
    })),
  ].flatMap(({ field, fieldId }) => {
    const message = errors[field];
    return message ? [{ fieldId, message }] : [];
  });

  return (
    <>
      <StaffFormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={option ? `Edit ${option.name}` : "New framing option"}
        description="Prices include VAT. Each edition chooses which options to offer, and shoppers see the name and the details."
        submitLabel={option ? "Save option" : "Add option"}
        pending={action.pending}
        onSubmit={() => void submit()}
        size="md"
      >
        <FormErrorSummary focusKey={submitCount} errors={summary} />
        {action.error}
        {placeholder ? (
          <Notice tone="info" title="Placeholder prices">
            Replace them with the framer's prices to offer this option.
          </Notice>
        ) : null}
        <Field label="Name shoppers see" id={id("name")} error={errors.name}>
          <TextInput
            maxLength={FRAMING_NAME_MAX_LENGTH}
            autoComplete="off"
            value={values.name}
            onChange={(event) => change({ name: event.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Frame" id={id("frame")}>
            <EnumSelect
              value={values.frame}
              options={FRAME_OPTIONS}
              onValueChange={(frame) => change({ frame })}
            />
          </Field>
          <Field label="Mount" id={id("mount")}>
            <EnumSelect
              value={values.mount}
              options={MOUNT_OPTIONS}
              onValueChange={(mount) => change({ mount })}
            />
          </Field>
          <Field
            label="Glazing"
            id={id("glazing")}
            description="Glass is not offered online: it is not safe to post."
          >
            <EnumSelect
              value={values.glazing}
              options={GLAZING_OPTIONS}
              onValueChange={(glazing) => change({ glazing })}
            />
          </Field>
          <Field label="Hanging" id={id("hanging")}>
            <EnumSelect
              value={values.hanging}
              options={HANGING_OPTIONS}
              onValueChange={(hanging) => change({ hanging })}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-staff-sm font-medium text-staff-fg">
            Lead time in working days
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shortest" id={id("lead-min")} error={errors.leadTimeMinDays}>
              <TextInput
                inputMode="numeric"
                autoComplete="off"
                value={values.leadTimeMinDays}
                onChange={(event) => change({ leadTimeMinDays: event.target.value })}
              />
            </Field>
            <Field label="Longest" id={id("lead-max")} error={errors.leadTimeMaxDays}>
              <TextInput
                inputMode="numeric"
                autoComplete="off"
                value={values.leadTimeMaxDays}
                onChange={(event) => change({ leadTimeMaxDays: event.target.value })}
              />
            </Field>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-staff-sm font-medium text-staff-fg">
            Price by sheet size, including VAT
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {FRAMING_BAND_CODES.map((band) => (
              <Field
                key={band}
                label={framingBandLabel(band)}
                id={id(`price-${band}`)}
                error={errors[PRICE_FIELD(band)]}
              >
                <MoneyInput
                  value={values.prices[band]}
                  placeholder="0.00"
                  onValueChange={(pence) => change({ prices: { ...values.prices, [band]: pence } })}
                />
              </Field>
            ))}
          </div>
          <p className="text-staff-xs text-staff-muted">
            Larger than 80 × 100 cm: framing is quoted.
          </p>
        </fieldset>
        <ChoiceRow
          htmlFor={id("offered")}
          disabled={placeholder}
          label="Offered"
          description={
            placeholder
              ? "Enter the framer's prices to offer this option."
              : "Editions can offer it. Turn off to pause it everywhere."
          }
          control={
            <StaffCheckbox
              id={id("offered")}
              checked={values.offered && !placeholder}
              disabled={placeholder}
              onCheckedChange={(checked) => change({ offered: checked === true })}
            />
          }
        />
      </StaffFormDialog>
      {action.stepUpDialog}
    </>
  );
}
