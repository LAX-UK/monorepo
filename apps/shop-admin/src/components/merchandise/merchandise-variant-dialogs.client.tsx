"use client";

import { AdminMutationFeedback } from "@/components/admin-mutation-feedback";
import { TextField } from "@/components/forms/fields";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
import { FormScopeProvider } from "@/components/forms/form-field";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { type FieldErrors, hasFieldErrors } from "@/lib/form-validation";
import { conflictField, validateStockAdjustment, validateVariant } from "@/lib/merchandise-form";
import {
  addMerchandiseVariant,
  adjustMerchandiseStock,
  updateMerchandiseVariant,
} from "@/server/application/admin-merchandise-actions.server";
import type { MerchandiseVariantDetail } from "@auction/shop-contracts";
import { formatPenceAsPounds } from "@auction/staff-ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingButton,
} from "@auction/ui";
import { type ReactNode, useId, useState } from "react";

/** Shell shared by the variant dialogs: a titled form whose footer holds Cancel and the verb. */
function VariantDialogFrame({
  title,
  description,
  scope,
  errors,
  mutation,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description: ReactNode;
  scope: string;
  errors: FieldErrors;
  mutation: ReturnType<typeof useAdminMutation>;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <FormScopeProvider value={scope}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-on-surface-variant">{description}</div>
          </DialogDescription>
        </DialogHeader>
        {hasFieldErrors(errors) ? <FormErrorSummary scope={scope} errors={errors} /> : null}
        <div className="grid gap-3">{children}</div>
        <AdminMutationFeedback
          message={hasFieldErrors(errors) ? null : mutation.message}
          stepUpRequired={mutation.stepUpRequired}
          stepUpHref={mutation.stepUpHref}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={mutation.pending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" loading={mutation.pending} loadingLabel="Saving…">
            {submitLabel}
          </LoadingButton>
        </DialogFooter>
      </form>
    </FormScopeProvider>
  );
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
  const scope = useId();
  const mutation = useAdminMutation();
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [price, setPrice] = useState(variant ? formatPenceAsPounds(variant.pricePence) : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  // A taken SKU comes back from the server; show it against the SKU field, not as a loose message.
  const taken = conflictField(mutation.message ?? "") === "sku" ? mutation.message : null;
  const shown: FieldErrors = { ...errors, ...(taken ? { sku: taken } : {}) };

  function submit() {
    const checked = validateVariant({ sku, price });
    setErrors(checked.ok ? {} : checked.errors);
    if (!checked.ok) return;
    void mutation
      .run(
        () =>
          variant
            ? updateMerchandiseVariant({
                variantId: variant.variantId,
                payload: checked.value,
                idempotencyKey: mutation.idempotencyKey,
              })
            : addMerchandiseVariant({
                productId,
                payload: checked.value,
                idempotencyKey: mutation.idempotencyKey,
              }),
        variant ? "Variant saved." : "Variant added.",
      )
      .then((saved) => {
        if (saved) onClose();
      });
  }

  return (
    <VariantDialogFrame
      title={variant ? `Edit ${variant.sku}` : "Add a variant"}
      description={
        variant
          ? "A new price applies to new baskets. Shoppers who already hold this variant must refresh their basket to see it before they can pay."
          : "A variant is one SKU with its own price. It starts with no stock; use Adjust stock to add units."
      }
      scope={scope}
      errors={shown}
      mutation={mutation}
      submitLabel={variant ? "Save variant" : "Add variant"}
      onClose={onClose}
      onSubmit={submit}
    >
      <TextField
        name="sku"
        label="SKU"
        value={sku}
        error={shown.sku}
        disabled={mutation.pending}
        maxLength={64}
        onChange={setSku}
      />
      <TextField
        name="price"
        label="Price (£)"
        hint="In pounds, for example 12.50."
        value={price}
        error={shown.price}
        disabled={mutation.pending}
        onChange={setPrice}
      />
    </VariantDialogFrame>
  );
}

function StockForm({
  variant,
  onClose,
}: {
  variant: MerchandiseVariantDetail;
  onClose: () => void;
}) {
  const scope = useId();
  const mutation = useAdminMutation();
  const [onHand, setOnHand] = useState(String(variant.onHand));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit() {
    const checked = validateStockAdjustment({ onHand, reason }, variant.reserved);
    setErrors(checked.ok ? {} : checked.errors);
    if (!checked.ok) return;
    void mutation
      .run(
        () =>
          adjustMerchandiseStock({
            variantId: variant.variantId,
            payload: checked.value,
            idempotencyKey: mutation.idempotencyKey,
          }),
        "Stock updated.",
      )
      .then((saved) => {
        if (saved) onClose();
      });
  }

  return (
    <VariantDialogFrame
      title={`Adjust stock for ${variant.sku}`}
      description={`Set the count of units physically on hand. ${variant.reserved} ${
        variant.reserved === 1 ? "unit is" : "units are"
      } held for open checkouts and cannot be removed. The change and your reason are recorded in the audit log.`}
      scope={scope}
      errors={errors}
      mutation={mutation}
      submitLabel="Update stock"
      onClose={onClose}
      onSubmit={submit}
    >
      <TextField
        name="onHand"
        label="On hand"
        type="number"
        min={0}
        value={onHand}
        error={errors.onHand}
        disabled={mutation.pending}
        onChange={setOnHand}
      />
      <TextField
        name="reason"
        label="Reason"
        hint="For example “Recount after delivery”."
        value={reason}
        error={errors.reason}
        disabled={mutation.pending}
        maxLength={200}
        onChange={setReason}
      />
    </VariantDialogFrame>
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
  return (
    <Dialog
      open={dialog !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md border-border-hairline">
        {dialog?.kind === "stock" ? (
          <StockForm variant={dialog.variant} onClose={onClose} />
        ) : dialog ? (
          <VariantForm
            productId={productId}
            variant={dialog.kind === "edit" ? dialog.variant : null}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
