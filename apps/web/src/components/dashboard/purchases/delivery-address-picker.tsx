"use client";

import { AddressFields } from "@/components/address/address-fields";
import {
  type AddressFieldErrors,
  type AddressValues,
  EMPTY_ADDRESS,
  validateAddress,
} from "@/lib/address/address-fields";
import {
  type AddressContext,
  DEFAULT_ADDRESS_LABEL,
  type DeliveryAddress,
} from "@/lib/purchases/delivery-addresses.vm";
import { saveDeliveryAddressAction } from "@/lib/purchases/purchase.actions";
import { Button } from "@auction/ui/lax/button";
import { Dialog, DialogClose } from "@auction/ui/lax/dialog";
import { EmptyState } from "@auction/ui/lax/empty-state";
import { Field } from "@auction/ui/lax/field";
import { TextInput } from "@auction/ui/lax/input";
import { Notice } from "@auction/ui/lax/notice";
import { PresetCards } from "@auction/ui/lax/preset-cards";
import { Skeleton } from "@auction/ui/lax/skeleton";
import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

function AddAddressDialog({
  organisation,
  onSaved,
  onClose,
}: {
  /** The organisation the address is added to; `null` adds it to the member's address book. */
  organisation: { id: string; name: string } | null;
  onSaved: (address: DeliveryAddress) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState<AddressValues>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<AddressFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    const problems = validateAddress(address);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    start(async () => {
      setError(null);
      const result = await saveDeliveryAddressAction(label, address, organisation?.id ?? null);
      if (result.ok) onSaved(result.address);
      else setError(result.message);
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => (next || pending ? undefined : onClose())}
      title="Add an address"
      description={
        organisation
          ? `It is saved to ${organisation.name}'s addresses, so every member who buys for it can pick it.`
          : "It is saved to your LAX Account address book, so you can pick it again next time."
      }
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={pending}>Cancel</Button>
          </DialogClose>
          <Button variant="primary" loading={pending} onClick={save}>
            Save address
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {organisation ? null : (
          <Field
            label="Name"
            description={`For example "Gallery store". Defaults to "${DEFAULT_ADDRESS_LABEL}".`}
            optional
          >
            <TextInput
              maxLength={80}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              disabled={pending}
            />
          </Field>
        )}
        <AddressFields
          values={address}
          onChange={(patch) => setAddress((current) => ({ ...current, ...patch }))}
          errors={errors}
          disabled={pending}
        />
        {error ? <Notice tone="danger" alert title={error} /> : null}
      </div>
    </Dialog>
  );
}

/**
 * Where to deliver: the payer's saved addresses (and, for an organisation, its registered,
 * delivery and invoice addresses) as cards to choose from, with "Add an address" in a dialog.
 * With none yet it asks for the first rather than showing an empty list. The choice is reported
 * up as an id, or `null`. An address is added to the organisation when the member may add one,
 * otherwise to their own address book.
 */
export function DeliveryAddressPicker({
  addresses,
  value,
  onValueChange,
  error,
  context = null,
  loading = false,
  disabled = false,
}: {
  addresses: readonly DeliveryAddress[];
  value: string | null;
  onValueChange: (id: string, address: DeliveryAddress) => void;
  /** Why the last request was refused, shown beneath the choice. */
  error: string | null;
  /** Whose addresses these are when buying for an organisation. */
  context?: AddressContext | null;
  /** The addresses are still being read. */
  loading?: boolean;
  disabled?: boolean;
}) {
  const [added, setAdded] = useState<readonly DeliveryAddress[]>([]);
  const [adding, setAdding] = useState(false);
  const all = [...addresses, ...added.filter((a) => !addresses.some((s) => s.id === a.id))];

  const saved = (address: DeliveryAddress) => {
    setAdded((current) => [...current, address]);
    onValueChange(address.id, address);
    setAdding(false);
  };

  const organisation = context?.canAdd
    ? { id: context.organisationId, name: context.organisationName }
    : null;

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <output className="sr-only">Loading addresses</output>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-lax-card" />
          <Skeleton className="h-20 rounded-lax-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {context?.loadFailed ? (
        <Notice
          tone="warning"
          title={`We couldn't load ${context.organisationName}'s addresses`}
          alert
        >
          Your own addresses are shown. Try again in a moment, or add an address.
        </Notice>
      ) : null}
      {all.length === 0 ? (
        <EmptyState
          size="compact"
          headingLevel="h3"
          illustration="parcel"
          title="No saved addresses yet"
          description="Add the address the work should be delivered to. We quote insured delivery to it."
          actions={
            <Button icon={<Plus aria-hidden />} onClick={() => setAdding(true)} disabled={disabled}>
              Add an address
            </Button>
          }
        />
      ) : (
        <>
          <PresetCards<string>
            label="Deliver to"
            value={value ?? ""}
            onValueChange={(id) => {
              const chosen = all.find((a) => a.id === id);
              if (chosen) onValueChange(id, chosen);
            }}
            options={all.map((a) => ({ value: a.id, label: a.label, description: a.detail }))}
            columns={all.length === 1 ? 1 : 2}
            compact
          />
          <div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus aria-hidden />}
              onClick={() => setAdding(true)}
              disabled={disabled}
            >
              Add an address
            </Button>
          </div>
        </>
      )}
      {error ? <Notice tone="danger" alert title={error} /> : null}
      {adding ? (
        <AddAddressDialog
          organisation={organisation}
          onSaved={saved}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}
