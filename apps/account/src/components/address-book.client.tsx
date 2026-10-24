"use client";

import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from "@/server/application/account-identity-actions.server";
import type { AccountActionResult } from "@/server/domain/account-action-result";
import {
  addressDefaultBadges,
  addressLines,
  addressToFormValues,
  canAddAddress,
  emptyAddressForm,
} from "@/server/domain/account-addresses.vm";
import { buildReauthHref } from "@/server/domain/account-reauth";
import type {
  AccountAddress,
  AccountAddressDefaultKind,
} from "@auction/identity-contracts/account";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AddressForm } from "./address-form.client";

type AddressBookProps = {
  addresses: AccountAddress[];
  /** Pre-fills the recipient of a new address. */
  defaultRecipient: string;
  /** Where to come back to after a fresh sign-in, which changing an address may require. */
  returnTo: string;
};

type Editing = { kind: "none" } | { kind: "new" } | { kind: "edit"; address: AccountAddress };
type Notice = { kind: "error" | "success"; message: string };

/**
 * The person's LAX-wide address book. Adding, editing and deleting need a recent sign-in; when
 * the issuer says it is too old the person is sent through a fresh one and returns here. Each
 * edit carries the version the person saw, so a change made elsewhere is reported instead of
 * silently overwritten.
 */
export function AddressBook({ addresses, defaultRecipient, returnTo }: AddressBookProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const [deleting, setDeleting] = useState<AccountAddress | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AccountActionResult>, onOk: () => void, onError?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(returnTo));
        return;
      }
      if (result.status === "error") {
        if (onError) onError();
        setNotice({ kind: "error", message: result.message });
        setFormError(result.message);
        return;
      }
      setNotice({ kind: "success", message: result.message });
      onOk();
      router.refresh();
    });
  }

  function closeForm() {
    setEditing({ kind: "none" });
    setFormError(null);
  }

  function makeDefault(address: AccountAddress, kind: AccountAddressDefaultKind) {
    setNotice(null);
    run(
      () => setDefaultAddressAction(address.id, kind),
      () => undefined,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        {notice && editing.kind === "none" ? (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={notice.kind === "error" ? "text-sm text-error" : "text-sm text-success"}
          >
            {notice.message}
          </p>
        ) : null}
      </div>

      {addresses.length === 0 && editing.kind === "none" ? (
        <p className="text-sm text-on-surface-variant">
          You haven't saved an address yet. Saved addresses are offered at checkout in LAX Bid, LAX
          Shop and lax.art.
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {addresses.map((address) => {
          const badges = addressDefaultBadges(address);
          return (
            <li
              key={address.id}
              className="flex flex-col gap-4 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline text-lg font-semibold break-words text-on-surface">
                  {address.label}
                </h3>
                {badges.map((badge) => (
                  <DotStatusPill key={badge} label={badge} tone="success" />
                ))}
              </div>
              <address className="text-sm leading-relaxed text-on-surface not-italic">
                {addressLines(address).map((line) => (
                  <span key={line} className="block [overflow-wrap:anywhere]">
                    {line}
                  </span>
                ))}
                {address.phone ? (
                  <span className="mt-1 block text-on-surface-variant">{address.phone}</span>
                ) : null}
              </address>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Button
                  type="button"
                  variant="link"
                  size="inline"
                  className="min-h-11"
                  disabled={pending}
                  aria-label={`Edit ${address.label}`}
                  onClick={() => {
                    setNotice(null);
                    setFormError(null);
                    setEditing({ kind: "edit", address });
                  }}
                >
                  Edit
                </Button>
                {address.isDefaultShipping ? null : (
                  <Button
                    type="button"
                    variant="link"
                    size="inline"
                    className="min-h-11"
                    disabled={pending}
                    aria-label={`Make ${address.label} your default shipping address`}
                    onClick={() => makeDefault(address, "shipping")}
                  >
                    Make default shipping
                  </Button>
                )}
                {address.isDefaultBilling ? null : (
                  <Button
                    type="button"
                    variant="link"
                    size="inline"
                    className="min-h-11"
                    disabled={pending}
                    aria-label={`Make ${address.label} your default billing address`}
                    onClick={() => makeDefault(address, "billing")}
                  >
                    Make default billing
                  </Button>
                )}
                <Button
                  type="button"
                  variant="link"
                  size="inline"
                  className="min-h-11 text-error"
                  disabled={pending}
                  aria-label={`Delete ${address.label}`}
                  onClick={() => {
                    setNotice(null);
                    setDeleting(address);
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {editing.kind === "new" ? (
        <AddressForm
          key="new"
          heading="Add an address"
          submitLabel="Save address"
          initial={emptyAddressForm(defaultRecipient)}
          pending={pending}
          error={formError}
          onCancel={closeForm}
          onSubmit={(input) => {
            setFormError(null);
            run(() => addAddressAction(input), closeForm);
          }}
        />
      ) : null}

      {editing.kind === "edit" ? (
        <AddressForm
          key={editing.address.id}
          heading={`Edit ${editing.address.label}`}
          submitLabel="Save changes"
          initial={addressToFormValues(editing.address)}
          pending={pending}
          error={formError}
          onCancel={closeForm}
          onSubmit={(input) => {
            setFormError(null);
            run(
              () => updateAddressAction(editing.address.id, editing.address.version, input),
              closeForm,
            );
          }}
        />
      ) : null}

      {editing.kind === "none" ? (
        canAddAddress(addresses.length) ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 self-start"
            disabled={pending}
            onClick={() => {
              setNotice(null);
              setFormError(null);
              setEditing({ kind: "new" });
            }}
          >
            Add an address
          </Button>
        ) : (
          <p className="text-sm text-on-surface-variant">
            You've saved the most addresses we allow. Delete one to add another.
          </p>
        )
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? `Delete ${deleting.label}?` : "Delete address?"}
        body={
          <>
            This removes the address from your LAX account. Orders and invoices that already used it
            keep their own copy.
            {deleting?.isDefaultShipping || deleting?.isDefaultBilling
              ? " Your oldest remaining address becomes the default instead."
              : ""}
          </>
        }
        confirmLabel="Delete address"
        loading={pending}
        onConfirm={() => {
          if (!deleting) return;
          const target = deleting;
          run(
            () => deleteAddressAction(target.id, target.version),
            () => setDeleting(null),
            () => setDeleting(null),
          );
        }}
      />
    </div>
  );
}
