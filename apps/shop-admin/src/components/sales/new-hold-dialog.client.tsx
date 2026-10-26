"use client";

import { EditionPicker, PartyPicker } from "@/components/pickers/record-pickers.client";
import { checkResolver, summaryOf } from "@/components/sales/sales-form";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { createStockHold } from "@/server/application/admin-sales-actions.server";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { HOLD_NOTE_MAX_LENGTH, checkStockHold } from "@/server/domain/sales-records.vm";
import { DateTimeInput, Field, FormErrorSummary, TextArea } from "@auction/staff-ui";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";

type HoldValues = {
  edition: LookupOption | null;
  client: LookupOption | null;
  expiresAt: string | null;
  note: string;
};

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
  const [now] = useState(() => new Date());
  const base = useId();
  const ids = {
    edition: `${base}-edition`,
    client: `${base}-client`,
    expiresAt: `${base}-ends`,
    note: `${base}-note`,
  };
  const form = useForm<HoldValues>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { edition: null, client: null, expiresAt: null, note: "" },
    resolver: checkResolver((values) => checkStockHold({ ...values, now })),
  });
  const { errors, submitCount } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const checked = checkStockHold({ ...values, now });
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () => createStockHold({ ...body, idempotencyKey: mutation.idempotencyKey }),
      `Hold created on ${values.edition?.label ?? "the edition"}`,
    );
    if (ok) onOpenChange(false);
  });

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
        <FormErrorSummary
          focusKey={submitCount}
          errors={summaryOf(errors, [
            { field: "edition", id: ids.edition },
            { field: "client", id: ids.client },
            { field: "expiresAt", id: ids.expiresAt },
            { field: "note", id: ids.note },
          ])}
        />
        {mutation.error}
        <Field label="Edition" id={ids.edition} error={errors.edition?.message}>
          <Controller
            control={form.control}
            name="edition"
            render={({ field }) => <EditionPicker value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field label="Client" id={ids.client} error={errors.client?.message}>
          <Controller
            control={form.control}
            name="client"
            render={({ field }) => <PartyPicker value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field label="Hold ends" id={ids.expiresAt} error={errors.expiresAt?.message}>
          <Controller
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <DateTimeInput
                value={field.value}
                onValueChange={field.onChange}
                min={now.toISOString()}
              />
            )}
          />
        </Field>
        <Field label="Note" optional id={ids.note} error={errors.note?.message}>
          <TextArea rows={2} maxLength={HOLD_NOTE_MAX_LENGTH} {...form.register("note")} />
        </Field>
      </StaffFormDialog>
      {mutation.stepUpDialog}
    </>
  );
}
