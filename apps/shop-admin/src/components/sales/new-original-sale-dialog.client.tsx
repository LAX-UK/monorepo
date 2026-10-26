"use client";

import { ArtworkPicker, PartyPicker } from "@/components/pickers/record-pickers.client";
import { checkResolver, summaryOf } from "@/components/sales/sales-form";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { createOriginalSale } from "@/server/application/admin-sales-actions.server";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { checkOriginalSale } from "@/server/domain/sales-records.vm";
import {
  DateTimeInput,
  Field,
  FormErrorSummary,
  MoneyInput,
  formatStaffMoney,
} from "@auction/staff-ui";
import { useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

type OriginalSaleValues = {
  artwork: LookupOption | null;
  buyer: LookupOption | null;
  pricePence: number | null;
  reservationExpiresAt: string | null;
};

/**
 * Reserve the original of an artwork for a buyer at an agreed price, in pounds. An optional end
 * time releases the reservation if no invoice follows. The invoice is issued from the sale's row.
 */
export function NewOriginalSaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAdminAction();
  const [now] = useState(() => new Date());
  /** Whether the price box has text, so "not an amount" reads differently from "left empty". */
  const priceTyped = useRef(false);
  const base = useId();
  const ids = {
    artwork: `${base}-artwork`,
    buyer: `${base}-buyer`,
    price: `${base}-price`,
    reservationExpiresAt: `${base}-ends`,
  };
  const check = (values: OriginalSaleValues) =>
    checkOriginalSale({ ...values, priceTyped: priceTyped.current, now });
  const form = useForm<OriginalSaleValues>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { artwork: null, buyer: null, pricePence: null, reservationExpiresAt: null },
    resolver: checkResolver(check, { price: "pricePence" }),
  });
  const { errors, submitCount } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const checked = check(values);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () => createOriginalSale({ ...body, idempotencyKey: mutation.idempotencyKey }),
      `${values.artwork?.label ?? "Original"} reserved for ${formatStaffMoney(body.salePricePence)}`,
    );
    if (ok) onOpenChange(false);
  });

  return (
    <>
      <StaffFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Reserve an original"
        description="Reserve the original for a buyer, then issue their invoice from the sale. It is assigned to them once they pay."
        submitLabel="Reserve original"
        pending={mutation.pending}
        onSubmit={() => void submit()}
      >
        <FormErrorSummary
          focusKey={submitCount}
          errors={summaryOf(errors, [
            { field: "artwork", id: ids.artwork },
            { field: "buyer", id: ids.buyer },
            { field: "pricePence", id: ids.price },
            { field: "reservationExpiresAt", id: ids.reservationExpiresAt },
          ])}
        />
        {mutation.error}
        <Field label="Artwork" id={ids.artwork} error={errors.artwork?.message}>
          <Controller
            control={form.control}
            name="artwork"
            render={({ field }) => <ArtworkPicker value={field.value} onChange={field.onChange} />}
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
          label="Sale price"
          description="In pounds."
          id={ids.price}
          error={errors.pricePence?.message}
        >
          <Controller
            control={form.control}
            name="pricePence"
            render={({ field }) => (
              <MoneyInput
                value={field.value}
                onValueChange={field.onChange}
                onInput={(event) => {
                  priceTyped.current = Boolean(event.currentTarget.value.trim());
                }}
                placeholder="0.00"
                boxClassName="max-w-48"
              />
            )}
          />
        </Field>
        <Field
          label="Reservation ends"
          optional
          description="Leave empty to hold it until it is invoiced."
          id={ids.reservationExpiresAt}
          error={errors.reservationExpiresAt?.message}
        >
          <Controller
            control={form.control}
            name="reservationExpiresAt"
            render={({ field }) => (
              <DateTimeInput
                value={field.value}
                onValueChange={field.onChange}
                min={now.toISOString()}
              />
            )}
          />
        </Field>
      </StaffFormDialog>
      {mutation.stepUpDialog}
    </>
  );
}
