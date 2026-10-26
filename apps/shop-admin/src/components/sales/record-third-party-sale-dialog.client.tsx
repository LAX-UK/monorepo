"use client";

import { EditionPicker, PartyPicker } from "@/components/pickers/record-pickers.client";
import { checkResolver, summaryOf } from "@/components/sales/sales-form";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { recordThirdPartySale } from "@/server/application/admin-sales-actions.server";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { checkThirdPartySale } from "@/server/domain/sales-records.vm";
import { Field, FormErrorSummary, MoneyInput, formatStaffMoney } from "@auction/staff-ui";
import { useId, useRef } from "react";
import { Controller, useForm } from "react-hook-form";

type ThirdPartySaleValues = {
  edition: LookupOption | null;
  seller: LookupOption | null;
  buyer: LookupOption | null;
  grossPence: number | null;
};

/**
 * Record a sale made outside the shop: the edition, who sold it, who bought it and what the buyer
 * paid, in pounds. All three records are chosen by name.
 */
export function RecordThirdPartySaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAdminAction();
  /** Whether the amount box has text, so "not an amount" reads differently from "left empty". */
  const grossTyped = useRef(false);
  const base = useId();
  const ids = {
    edition: `${base}-edition`,
    seller: `${base}-seller`,
    buyer: `${base}-buyer`,
    gross: `${base}-gross`,
  };
  const check = (values: ThirdPartySaleValues) =>
    checkThirdPartySale({ ...values, grossTyped: grossTyped.current });
  const form = useForm<ThirdPartySaleValues>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { edition: null, seller: null, buyer: null, grossPence: null },
    resolver: checkResolver(check, { gross: "grossPence" }),
  });
  const { errors, submitCount } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const checked = check(values);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () => recordThirdPartySale({ ...body, idempotencyKey: mutation.idempotencyKey }),
      `Sale of ${values.edition?.label ?? "the edition"} recorded for ${formatStaffMoney(body.grossPence)}`,
    );
    if (ok) onOpenChange(false);
  });

  return (
    <>
      <StaffFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Record a third-party sale"
        description="A sale made through a partner outside the shop. Finance approves its fee afterwards."
        submitLabel="Record sale"
        pending={mutation.pending}
        onSubmit={() => void submit()}
      >
        <FormErrorSummary
          focusKey={submitCount}
          errors={summaryOf(errors, [
            { field: "edition", id: ids.edition },
            { field: "seller", id: ids.seller },
            { field: "buyer", id: ids.buyer },
            { field: "grossPence", id: ids.gross },
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
        <Field label="Seller" id={ids.seller} error={errors.seller?.message}>
          <Controller
            control={form.control}
            name="seller"
            render={({ field }) => (
              <PartyPicker
                value={field.value}
                onChange={(option) => {
                  field.onChange(option);
                  // The buyer and seller must differ, so a change here can clear or raise the
                  // buyer's error.
                  if (submitCount > 0) void form.trigger("buyer");
                }}
              />
            )}
          />
        </Field>
        <Field label="Buyer" id={ids.buyer} error={errors.buyer?.message}>
          <Controller
            control={form.control}
            name="buyer"
            render={({ field }) => <PartyPicker value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field
          label="Amount the buyer paid"
          description="In pounds, before any fees."
          id={ids.gross}
          error={errors.grossPence?.message}
        >
          <Controller
            control={form.control}
            name="grossPence"
            render={({ field }) => (
              <MoneyInput
                value={field.value}
                onValueChange={field.onChange}
                onInput={(event) => {
                  grossTyped.current = Boolean(event.currentTarget.value.trim());
                }}
                placeholder="0.00"
                boxClassName="max-w-48"
              />
            )}
          />
        </Field>
      </StaffFormDialog>
      {mutation.stepUpDialog}
    </>
  );
}
