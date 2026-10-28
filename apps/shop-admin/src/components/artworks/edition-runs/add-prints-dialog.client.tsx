"use client";

import { CustodyChoice } from "@/components/artworks/edition-runs/run-fields.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  type StockBatchFormValues,
  addPrintsLabel,
  emptyStockBatchForm,
  stockBatchBody,
  stockBatchOutcome,
  validateStockBatchForm,
  withQuantity,
} from "@/lib/stock-batch-form";
import { addOpenEditionStock } from "@/server/application/edition-run-actions.server";
import {
  Field,
  FieldRow,
  Notice,
  StaffButton,
  StaffDialog,
  TextInput,
  toast,
} from "@auction/staff-ui";
import { useState } from "react";

const FORM_ID = "add-prints";

/**
 * "Add prints" to an open edition: how many, the artist / LAX split proposed from the run's
 * default, whether they are already printed and, if so, where they are stored.
 */
export function AddPrintsDialog({
  open,
  onOpenChange,
  artworkId,
  defaultArtistPct,
  nextStockRef,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  defaultArtistPct: number;
  nextStockRef: number;
  onAdded: () => void;
}) {
  const [values, setValues] = useState(() => emptyStockBatchForm(defaultArtistPct));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const errors = attempted ? validateStockBatchForm(values) : {};
  const outcome = stockBatchOutcome(values, nextStockRef);

  function update(patch: Partial<StockBatchFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function reset(next: boolean) {
    if (saving) return;
    if (next) {
      setValues(emptyStockBatchForm(defaultArtistPct));
      setAttempted(false);
      setFormError(null);
      setIdempotencyKey(crypto.randomUUID());
    }
    onOpenChange(next);
  }

  async function submit() {
    if (Object.keys(validateStockBatchForm(values)).length > 0) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await addOpenEditionStock({
      artworkId,
      body: stockBatchBody(values),
      idempotencyKey,
    }).catch(() => ({ ok: false, kind: "failed", message: "Adding failed. Try again." }) as const);
    setSaving(false);
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      return;
    }
    const { quantity, laxPrintsOnSale } = result.data;
    toast.success(
      `Added ${quantity === 1 ? "1 print" : `${quantity} prints`}. ${laxPrintsOnSale} of LAX's on sale now.`,
    );
    onOpenChange(false);
    onAdded();
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={reset}
      size="md"
      title="Add prints"
      description="Unnumbered prints, each with its own stock reference."
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={() => reset(false)}>
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={saving}>
            {addPrintsLabel(values)}
          </StaffButton>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        <Field label="How many" error={errors.quantity} id="add-prints-quantity">
          <TextInput
            inputMode="numeric"
            autoComplete="off"
            value={values.quantityText}
            trailing={<span className="text-staff-muted">prints</span>}
            boxClassName="sm:max-w-40"
            className="tabular-nums"
            onChange={(event) =>
              setValues((current) => withQuantity(current, event.target.value, defaultArtistPct))
            }
          />
        </Field>
        <FieldRow>
          <Field label="Artist" error={errors.split} id="add-prints-artist">
            <TextInput
              inputMode="numeric"
              autoComplete="off"
              value={values.artistText}
              className="tabular-nums"
              onChange={(event) => update({ artistText: event.target.value, splitEdited: true })}
            />
          </Field>
          <Field label="LAX" id="add-prints-lax">
            <TextInput
              inputMode="numeric"
              autoComplete="off"
              invalid={Boolean(errors.split)}
              value={values.laxText}
              className="tabular-nums"
              onChange={(event) => update({ laxText: event.target.value, splitEdited: true })}
            />
          </Field>
        </FieldRow>
        <CustodyChoice
          id="add-prints-custody"
          value={values.custody}
          onChange={(custody) => update({ custody })}
        />
        {values.custody === "stored" ? (
          <Field
            label="Storage"
            description="Where the printed stock is kept, such as Plan chest C, drawer 1."
            error={errors.storageLocation}
            id="add-prints-storage"
          >
            <TextInput
              value={values.storageLocation}
              onChange={(event) => update({ storageLocation: event.target.value })}
            />
          </Field>
        ) : null}
        {outcome ? <p className="text-staff-sm text-staff-muted">{outcome}</p> : null}
      </form>
    </StaffDialog>
  );
}
