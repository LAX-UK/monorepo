"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { Button } from "@auction/ui/components/button";
import { type AddressFormValues, addressToForm } from "./address-board-helpers";
import { AddressForm } from "./address-form";

export function SavedAddressRow({
  address,
  editing,
  pending,
  onEdit,
  onCancelEdit,
  onUpdate,
  onSetDefault,
  onRemove,
}: {
  address: ProfileAddressRow;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (values: AddressFormValues) => void;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  if (editing) {
    return (
      <AddressForm
        resetKey={address.id}
        initialValues={addressToForm(address)}
        pending={pending}
        submitLabel="Save"
        onCancel={onCancelEdit}
        onSubmit={onUpdate}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="font-body text-sm">
        <div className="flex items-center gap-2">
          <span className="font-label text-xs uppercase tracking-[0.16em]">{address.label}</span>
          {address.isDefault ? (
            <span className="rounded bg-success/10 px-2 py-0.5 font-label text-[10px] uppercase text-success">
              Default
            </span>
          ) : null}
          <span className="rounded bg-surface-container-high px-2 py-0.5 font-label text-[10px] uppercase text-on-surface-variant">
            {address.addressType === "both" ? "Billing + shipping" : address.addressType}
          </span>
        </div>
        <p className="mt-1">
          {address.line1}
          {address.line2 ? `, ${address.line2}` : ""}
        </p>
        <p className="text-on-surface-variant">
          {address.city}
          {address.state ? `, ${address.state}` : ""} {address.postalCode}, {address.country}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!address.isDefault ? (
          <Button type="button" variant="tertiary" disabled={pending} onClick={onSetDefault}>
            Set default
          </Button>
        ) : null}
        <Button type="button" variant="tertiary" onClick={onEdit}>
          Edit
        </Button>
        <ConfirmActionButton
          type="button"
          variant="destructive"
          disabled={pending}
          confirmTitle="Remove address"
          confirmBody="Remove this address from your account? Invoices and shipping may still reference archived records."
          confirmLabel="Remove"
          onConfirmed={onRemove}
        >
          Remove
        </ConfirmActionButton>
      </div>
    </div>
  );
}
