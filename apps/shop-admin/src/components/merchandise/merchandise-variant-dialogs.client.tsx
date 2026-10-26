"use client";

import { checkResolver, summaryOf } from "@/components/sales/sales-form";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { conflictField, validateStockAdjustment, validateVariant } from "@/lib/merchandise-form";
import {
  addMerchandiseVariant,
  adjustMerchandiseStock,
  updateMerchandiseVariant,
} from "@/server/application/admin-merchandise-actions.server";
import type { MerchandiseVariantDetail } from "@auction/shop-contracts";
import {
  Field,
  FormErrorSummary,
  MoneyInput,
  TextInput,
  formatPenceAsPounds,
} from "@auction/staff-ui";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";

type VariantValues = { sku: string; pricePence: number | null };
type StockValues = { onHand: string; reason: string };

function checkVariant(values: VariantValues) {
  return validateVariant({
    sku: values.sku,
    price: values.pricePence === null ? "" : formatPenceAsPounds(values.pricePence),
  });
}

function VariantForm({
  productId,
  variant,
  onClose,
}: {
  productId: string;
  /** The variant being edited, or null to add one. */
  variant: MerchandiseVariantDetail | null;
  onClose: () => void;
}) {
  const action = useAdminAction();
  const base = useId();
  const ids = { sku: `${base}-sku`, price: `${base}-price` };
  const form = useForm<VariantValues>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { sku: variant?.sku ?? "", pricePence: variant?.pricePence ?? null },
    resolver: checkResolver(checkVariant, { price: "pricePence" }),
  });
  const { errors, submitCount } = form.formState;
  // A taken SKU comes back from the server; show it against the SKU field.
  const taken = conflictField(action.message ?? "") === "sku" ? action.message : null;
  const skuError = errors.sku?.message ?? taken ?? undefined;
  const priceError = errors.pricePence?.message;
  const summary = [
    ...(skuError ? [{ fieldId: ids.sku, message: skuError }] : []),
    ...(priceError ? [{ fieldId: ids.price, message: priceError }] : []),
  ];

  const submit = form.handleSubmit(async (values) => {
    const checked = checkVariant(values);
    if (!checked.ok) return;
    const payload = checked.value;
    const ok = await action.run(
      () =>
        variant
          ? updateMerchandiseVariant({
              variantId: variant.variantId,
              payload,
              idempotencyKey: action.idempotencyKey,
            })
          : addMerchandiseVariant({
              productId,
              payload,
              idempotencyKey: action.idempotencyKey,
            }),
      variant ? "Variant saved" : "Variant added",
      variant ? "save this variant" : "add this variant",
    );
    if (ok) onClose();
  });

  return (
    <>
      <StaffFormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={variant ? `Edit ${variant.sku}` : "Add a variant"}
        description={
          variant
            ? "A new price applies to new baskets. Shoppers who already hold this variant must refresh their basket to see it before they can pay."
            : "A variant is one SKU with its own price. It starts with no stock; use Adjust stock to add units."
        }
        submitLabel={variant ? "Save variant" : "Add variant"}
        pending={action.pending}
        onSubmit={() => void submit()}
      >
        <FormErrorSummary focusKey={submitCount} errors={summary} />
        {taken ? null : action.error}
        <Field label="SKU" id={ids.sku} error={skuError}>
          <TextInput maxLength={64} autoComplete="off" {...form.register("sku")} />
        </Field>
        <Field
          label="Price"
          id={ids.price}
          description="In pounds, for example 12.50."
          error={priceError}
        >
          <Controller
            control={form.control}
            name="pricePence"
            render={({ field }) => (
              <MoneyInput
                ref={field.ref}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="0.00"
              />
            )}
          />
        </Field>
      </StaffFormDialog>
      {action.stepUpDialog}
    </>
  );
}

function StockForm({
  variant,
  onClose,
}: {
  variant: MerchandiseVariantDetail;
  onClose: () => void;
}) {
  const action = useAdminAction();
  const base = useId();
  const ids = { onHand: `${base}-on-hand`, reason: `${base}-reason` };
  const form = useForm<StockValues>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { onHand: String(variant.onHand), reason: "" },
    resolver: checkResolver((values) => validateStockAdjustment(values, variant.reserved)),
  });
  const { errors, submitCount } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const checked = validateStockAdjustment(values, variant.reserved);
    if (!checked.ok) return;
    const payload = checked.value;
    const ok = await action.run(
      () =>
        adjustMerchandiseStock({
          variantId: variant.variantId,
          payload,
          idempotencyKey: action.idempotencyKey,
        }),
      "Stock updated",
      "change this stock count",
    );
    if (ok) onClose();
  });

  return (
    <>
      <StaffFormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Adjust stock for ${variant.sku}`}
        description={`Set the count of units physically on hand. ${variant.reserved} ${
          variant.reserved === 1 ? "unit is" : "units are"
        } held for open checkouts and cannot be removed. The change and your reason are recorded in the audit log.`}
        submitLabel="Update stock"
        pending={action.pending}
        onSubmit={() => void submit()}
      >
        <FormErrorSummary
          focusKey={submitCount}
          errors={summaryOf(errors, [
            { field: "onHand", id: ids.onHand },
            { field: "reason", id: ids.reason },
          ])}
        />
        {action.error}
        <Field label="On hand" id={ids.onHand} error={errors.onHand?.message}>
          <TextInput type="number" min={0} inputMode="numeric" {...form.register("onHand")} />
        </Field>
        <Field
          label="Reason"
          id={ids.reason}
          description="For example “Recount after delivery”."
          error={errors.reason?.message}
        >
          <TextInput maxLength={200} autoComplete="off" {...form.register("reason")} />
        </Field>
      </StaffFormDialog>
      {action.stepUpDialog}
    </>
  );
}

export type VariantDialogState =
  | { kind: "add" }
  | { kind: "edit"; variant: MerchandiseVariantDetail }
  | { kind: "stock"; variant: MerchandiseVariantDetail };

/** Renders the open variant dialog; its form mounts fresh each time, so no old input lingers. */
export function MerchandiseVariantDialogs({
  productId,
  dialog,
  onClose,
}: {
  productId: string;
  dialog: VariantDialogState | null;
  onClose: () => void;
}) {
  if (!dialog) return null;
  if (dialog.kind === "stock") return <StockForm variant={dialog.variant} onClose={onClose} />;
  return (
    <VariantForm
      productId={productId}
      variant={dialog.kind === "edit" ? dialog.variant : null}
      onClose={onClose}
    />
  );
}
