"use client";

import { EditionPicker, PartyPicker } from "@/components/pickers/record-pickers.client";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { createStockHold } from "@/server/application/admin-sales-actions.server";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { HOLD_NOTE_MAX_LENGTH, checkStockHold } from "@/server/domain/sales-records.vm";
import { DateTimeInput, Field, TextArea } from "@auction/staff-ui";
import { useState } from "react";

/**
 * Hold an edition for a client: choose both by name, say when the hold ends (London time), and
 * optionally leave a note. The hold lifts by itself when it ends.
 */
export function NewHoldDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAdminAction();
  const [edition, setEdition] = useState<LookupOption | null>(null);
  const [client, setClient] = useState<LookupOption | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submits, setSubmits] = useState(0);
  const [now] = useState(() => new Date());

  const checked = checkStockHold({ edition, client, expiresAt, note, now });
  const errors = submits > 0 && !checked.ok ? checked.errors : {};

  const submit = async () => {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () => createStockHold({ ...body, idempotencyKey: mutation.idempotencyKey }),
      `Hold created on ${edition?.label ?? "the edition"}`,
    );
    if (ok) onOpenChange(false);
  };

  return (
    <>
      <StaffFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Hold an edition"
        description="The edition is kept back from sale for this client until the hold ends or you release it."
        submitLabel="Create hold"
        pending={mutation.pending}
        onSubmit={() => void submit()}
      >
        {mutation.error}
        <Field label="Edition" error={errors.edition}>
          <EditionPicker value={edition} onChange={setEdition} />
        </Field>
        <Field label="Client" error={errors.client}>
          <PartyPicker value={client} onChange={setClient} />
        </Field>
        <Field label="Hold ends" error={errors.expiresAt}>
          <DateTimeInput value={expiresAt} onValueChange={setExpiresAt} min={now.toISOString()} />
        </Field>
        <Field label="Note" optional error={errors.note}>
          <TextArea
            rows={2}
            maxLength={HOLD_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </StaffFormDialog>
      {mutation.stepUpDialog}
    </>
  );
}
