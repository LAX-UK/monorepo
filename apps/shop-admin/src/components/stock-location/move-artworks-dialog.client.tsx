"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { moveArtworksToLocation } from "@/server/application/admin-stock-location-actions.server";
import {
  MOVE_FIELD_LABELS,
  type MoveFormField,
  type MoveFormValues,
  checkMoveForm,
  fieldErrorsFromIssues,
  moveOptions,
  moveOutcomeMessage,
} from "@/server/domain/stock-location.vm";
import type { AdminStockLocation } from "@auction/shop-contracts";
import { EnumSelect, Field, FormErrorSummary, Notice, TextArea } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

const FIELDS: readonly MoveFormField[] = ["locationId", "note"];

/**
 * Move one artwork ("Move" on its record) or a selection ("Move selected" on All artworks) to an
 * active location, with an optional note kept in each artwork's history. Two fields, so a failed
 * move lists its problems at the top and beside each field. When the API refuses the place (it
 * was retired since the page loaded), the list of places is reloaded so another can be chosen.
 */
export function MoveArtworksDialog({
  registerIds,
  subject,
  locations,
  currentLocationId = null,
  currentLabel,
  onClose,
  onMoved,
}: {
  registerIds: readonly string[];
  /** What is moving, for the title: the artwork's title, or "3 artworks". */
  subject: string;
  /** Every location the page has; only active ones are offered. */
  locations: readonly AdminStockLocation[];
  /** One artwork: where it is now, marked in the list and said under the title. */
  currentLocationId?: string | null;
  currentLabel?: string;
  onClose: () => void;
  onMoved?: () => void;
}) {
  const action = useAdminAction();
  const router = useRouter();
  const base = useId();
  const fieldId = (field: MoveFormField) => `${base}-${field}`;
  const [values, setValues] = useState<MoveFormValues>({ locationId: null, note: "" });
  const [submits, setSubmits] = useState(0);
  /** The note's rules are shop-api's: a refused note comes back named. */
  const [issues, setIssues] = useState<readonly unknown[] | undefined>(undefined);
  const options = moveOptions(locations, currentLocationId);
  const checked = checkMoveForm(
    values,
    options.map((option) => ({ id: option.value })),
  );
  const errors = {
    ...fieldErrorsFromIssues(issues, FIELDS),
    ...(submits > 0 && !checked.ok ? checked.errors : {}),
  };
  const many = registerIds.length > 1;

  async function submit() {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const { locationId, note } = checked.body;
    const name = options.find((option) => option.value === locationId)?.label ?? "";
    const ok = await action.run(
      async () => {
        const result = await moveArtworksToLocation({
          body: { registerIds: [...registerIds], locationId, note },
          idempotencyKey: action.idempotencyKey,
        });
        // A place retired since the page loaded: fetch the list as it is now.
        if (!result.ok && result.kind === "conflict") router.refresh();
        setIssues(!result.ok && result.kind === "validation" ? result.issues : undefined);
        return result;
      },
      (result) => moveOutcomeMessage(result, name),
    );
    if (ok) {
      onMoved?.();
      onClose();
    } else setSubmits((count) => count + 1);
  }

  const summary = FIELDS.flatMap((field) =>
    errors[field]
      ? [{ fieldId: fieldId(field), message: `${MOVE_FIELD_LABELS[field]}: ${errors[field]}` }]
      : [],
  );

  return (
    <StaffFormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Move ${subject}`}
      description={
        currentLabel
          ? `Where it is now: ${currentLabel}.`
          : "Each artwork's history keeps the move."
      }
      submitLabel={many ? `Move ${registerIds.length} artworks` : "Move artwork"}
      pending={action.pending}
      onSubmit={() => void submit()}
    >
      <FormErrorSummary focusKey={submits} errors={summary} />
      {issues?.length ? null : action.error}
      {options.length === 0 ? (
        <Notice tone="warning" title="No locations to move to">
          An Administrator adds them in From Zoho, under Locations.
        </Notice>
      ) : null}
      <Field
        id={fieldId("locationId")}
        label={MOVE_FIELD_LABELS.locationId}
        error={errors.locationId}
      >
        <EnumSelect
          value={values.locationId}
          onValueChange={(locationId) => setValues((current) => ({ ...current, locationId }))}
          options={options}
          placeholder="Choose a location"
          disabled={options.length === 0}
          invalid={Boolean(errors.locationId)}
        />
      </Field>
      <Field
        id={fieldId("note")}
        label={MOVE_FIELD_LABELS.note}
        description="Why it moved, or for how long."
        error={errors.note}
        optional
      >
        <TextArea
          rows={3}
          value={values.note}
          onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
        />
      </Field>
    </StaffFormDialog>
  );
}
