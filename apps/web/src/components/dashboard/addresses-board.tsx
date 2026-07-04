"use client";

import {
  createAddressFromValuesAction,
  removeAddressAction,
  setDefaultAddressAction,
  updateAddressFromValuesAction,
} from "@/lib/actions/profile";
import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { notify } from "@/lib/ui/notify";
import { Surface } from "@auction/ui/components/surface";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { emptyAddress, normalizeAddress } from "./addresses/address-board-helpers";
import { AddressForm } from "./addresses/address-form";
import { SavedAddressRow } from "./addresses/saved-address-row";

export function AddressesBoard({
  addresses,
  returnAfterSave,
}: {
  addresses: ProfileAddressRow[];
  returnAfterSave?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (
    work: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    options?: { returnToCheckout?: boolean; onSuccess?: () => void },
  ) => {
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        options?.onSuccess?.();
        notify.success(success);
        if (options?.returnToCheckout && returnAfterSave) {
          router.push(returnAfterSave);
          return;
        }
        router.refresh();
        return;
      }
      notify.error(result.error ?? "Could not update address");
    });
  };

  return (
    <div className="space-y-6">
      <Surface variant="section" padding="md" className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Saved addresses
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            Manage shipping and invoice delivery addresses.
          </p>
        </div>
        <div className="space-y-4">
          {addresses.length === 0 ? (
            <p className="font-body text-sm text-on-surface-variant">No addresses saved yet.</p>
          ) : (
            addresses.map((address) => (
              <div key={address.id} className="rounded-sm border border-border-hairline p-4">
                <SavedAddressRow
                  address={address}
                  editing={editingId === address.id}
                  pending={pending}
                  onEdit={() => setEditingId(address.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onUpdate={(values) =>
                    run(
                      async () =>
                        updateAddressFromValuesAction(address.id, normalizeAddress(values)),
                      "Address updated",
                      { onSuccess: () => setEditingId(null) },
                    )
                  }
                  onSetDefault={() =>
                    run(async () => setDefaultAddressAction(address.id), "Default address updated")
                  }
                  onRemove={() =>
                    void run(async () => removeAddressAction(address.id), "Address removed")
                  }
                />
              </div>
            ))
          )}
        </div>
      </Surface>
      <Surface variant="section" padding="md" className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Add address
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            Add a new shipping address to your account.
          </p>
        </div>
        <div className="space-y-4">
          <AddressForm
            resetKey="new"
            initialValues={emptyAddress}
            pending={pending}
            submitLabel={pending ? "Saving..." : "Add address"}
            onSubmit={(values) =>
              run(
                async () => createAddressFromValuesAction(normalizeAddress(values)),
                "Address added",
                { returnToCheckout: true },
              )
            }
          />
        </div>
      </Surface>
    </div>
  );
}
