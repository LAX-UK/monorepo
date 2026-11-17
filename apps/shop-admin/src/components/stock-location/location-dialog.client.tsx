"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useLocationWrite } from "@/components/stock-location/use-location-write.client";
import {
  addStockLocation,
  saveStockLocation,
} from "@/server/application/admin-stock-location-actions.server";
import {
  LOCATION_FIELD_LABELS,
  type LocationFormErrors,
  type LocationFormField,
  type LocationFormValues,
  NAME_TAKEN,
  checkLocationForm,
  locationFormValues,
} from "@/server/domain/stock-location.vm";
import { LOCATION_NAME_MAX, LOCATION_NOTE_MAX } from "@auction/artwork-register-contracts";
import type { AdminStockLocation } from "@auction/shop-contracts";
import { Field, FormErrorSummary, TextInput } from "@auction/staff-ui";
import { useId, useState } from "react";

const FIELDS: readonly LocationFormField[] = ["name", "note"];

/**
 * Add a location, or rename one and change its note (`location` set). Two fields, so a failed
 * save lists every problem at the top and again beside each field; the same rules run on the
 * server. A rename saves against the version it was opened at: if someone else changed the
 * location since, the dialog says so and offers Reload, keeping what was typed.
 */
export function LocationDialog({
  location,
  locations,
  onClose,
}: {
  /** The location being changed, as the page has it now; null to add one. */
  location: AdminStockLocation | null;
  /** Every location, retired ones too, so a name in use is caught before saving. */
  locations: readonly AdminStockLocation[];
  onClose: () => void;
}) {
  const write = useLocationWrite();
  const base = useId();
  const fieldId = (field: LocationFormField) => `${base}-${field}`;
  const [values, setValues] = useState<LocationFormValues>(() => locationFormValues(location));
  const [submits, setSubmits] = useState(0);
  const checked = checkLocationForm(values, locations, location?.id ?? null);
  const errors: LocationFormErrors = {
    ...(submits > 0 && !checked.ok ? checked.errors : {}),
    // Someone added the same name since the page loaded.
    ...(write.refusal === "name_taken" ? { name: NAME_TAKEN } : {}),
  };
  const set = (field: LocationFormField, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  async function submit() {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const { name, note } = checked.body;
    const ok = await write.run(
      () =>
        location
          ? saveStockLocation({
              locationId: location.id,
              expectedVersion: location.version,
              name,
              note,
              idempotencyKey: write.idempotencyKey,
            })
          : addStockLocation({ name, note, idempotencyKey: write.idempotencyKey }),
      location ? `${name} saved` : `${name} added`,
      location ? "change this location" : "add a location",
    );
    if (ok) onClose();
  }

  const summary = FIELDS.flatMap((field) =>
    errors[field]
      ? [{ fieldId: fieldId(field), message: `${LOCATION_FIELD_LABELS[field]}: ${errors[field]}` }]
      : [],
  );

  return (
    <>
      <StaffFormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={location ? `Edit ${location.name}` : "Add location"}
        description="Staff pick from these names when they move an artwork."
        submitLabel={location ? "Save location" : "Add location"}
        pending={write.pending}
        onSubmit={() => void submit()}
      >
        <FormErrorSummary focusKey={submits} errors={summary} />
        {write.error}
        <Field
          id={fieldId("name")}
          label={LOCATION_FIELD_LABELS.name}
          description={`For example "Gallery, main room" or "Framer". Up to ${LOCATION_NAME_MAX} characters.`}
          error={errors.name}
        >
          <TextInput
            autoComplete="off"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <Field
          id={fieldId("note")}
          label={LOCATION_FIELD_LABELS.note}
          description={`Where to find it, or who to ask. Up to ${LOCATION_NOTE_MAX} characters.`}
          error={errors.note}
          optional
        >
          <TextInput
            autoComplete="off"
            value={values.note}
            onChange={(event) => set("note", event.target.value)}
          />
        </Field>
      </StaffFormDialog>
      {write.stepUpDialog}
    </>
  );
}
