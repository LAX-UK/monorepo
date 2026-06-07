"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import {
  createAddressFromValuesAction,
  removeAddressAction,
  setDefaultAddressAction,
  updateAddressFromValuesAction,
} from "@/lib/actions/profile";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Surface } from "@auction/ui/components/surface";
import { createAddressBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type AddressFormValues = z.infer<typeof createAddressBodySchema>;

const emptyAddress: AddressFormValues = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United Kingdom",
  addressType: "both",
  isDefault: false,
};

function addressToForm(address: ProfileAddressRow): AddressFormValues {
  return {
    label: address.label,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state ?? "",
    postalCode: address.postalCode,
    country: address.country,
    addressType: address.addressType,
    isDefault: address.isDefault,
  };
}

function normalizeAddress(values: AddressFormValues): AddressFormValues {
  return {
    label: values.label.trim(),
    line1: values.line1.trim(),
    line2: values.line2?.trim() || undefined,
    city: values.city.trim(),
    state: values.state?.trim() || undefined,
    postalCode: values.postalCode.trim(),
    country: values.country.trim(),
    addressType: values.addressType ?? "both",
    isDefault: values.isDefault ?? false,
  };
}

function AddressFields({ form }: { form: ReturnType<typeof useForm<AddressFormValues>> }) {
  const defaultAddressFieldId = useId();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Label
            </FormLabel>
            <FormControl>
              <UnderlineInput {...field} placeholder="Home, office, etc." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="line1"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Address line 1
            </FormLabel>
            <FormControl>
              <UnderlineInput {...field} placeholder="Street address" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="line2"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Address line 2
            </FormLabel>
            <FormControl>
              <UnderlineInput {...field} placeholder="Apartment, suite, etc. (optional)" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="city"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              City
            </FormLabel>
            <FormControl>
              <UnderlineInput {...field} placeholder="City" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="state"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              State / region
            </FormLabel>
            <FormControl>
              <UnderlineInput {...field} placeholder="State or region (optional)" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="postalCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Postal code
            </FormLabel>
            <FormControl>
              <UnderlineInput {...field} placeholder="Postal code" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="country"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Country
            </FormLabel>
            <FormControl>
              <UnderlineInput {...field} placeholder="Country" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="addressType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Address type
            </FormLabel>
            <RhfSelect
              value={field.value ?? "both"}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={[
                { value: "both", label: "Billing and shipping" },
                { value: "shipping", label: "Shipping only" },
                { value: "billing", label: "Billing only" },
              ]}
              triggerClassName="min-h-11 w-full font-body text-sm"
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="isDefault"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2">
            <FormControl>
              <Checkbox
                id={defaultAddressFieldId}
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            </FormControl>
            <FormLabel
              htmlFor={defaultAddressFieldId}
              className="cursor-pointer font-body text-sm font-normal text-on-surface"
            >
              Default address
            </FormLabel>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function AddressForm({
  resetKey,
  initialValues,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  /** Stable id — form resets only when this changes, not on parent re-renders. */
  resetKey: string;
  initialValues: AddressFormValues;
  pending: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (values: AddressFormValues) => void;
}) {
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(createAddressBodySchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the edited address (resetKey) changes, not on every initialValues identity change during re-renders.
  useEffect(() => {
    form.reset(initialValues);
  }, [form, resetKey]);

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => onSubmit(values))}>
        <AddressFields form={form} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={pending}>
            {submitLabel}
          </Button>
          {onCancel ? (
            <Button type="button" variant="tertiary" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}

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
                {editingId === address.id ? (
                  <AddressForm
                    resetKey={address.id}
                    initialValues={addressToForm(address)}
                    pending={pending}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) =>
                      run(
                        async () =>
                          updateAddressFromValuesAction(address.id, normalizeAddress(values)),
                        "Address updated",
                        { onSuccess: () => setEditingId(null) },
                      )
                    }
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="font-body text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-label text-xs uppercase tracking-[0.16em]">
                          {address.label}
                        </span>
                        {address.isDefault ? (
                          <span className="rounded bg-success/10 px-2 py-0.5 font-label text-[10px] uppercase text-success">
                            Default
                          </span>
                        ) : null}
                        <span className="rounded bg-surface-container-high px-2 py-0.5 font-label text-[10px] uppercase text-on-surface-variant">
                          {address.addressType === "both"
                            ? "Billing + shipping"
                            : address.addressType}
                        </span>
                      </div>
                      <p className="mt-1">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}
                      </p>
                      <p className="text-on-surface-variant">
                        {address.city}
                        {address.state ? `, ${address.state}` : ""} {address.postalCode},{" "}
                        {address.country}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!address.isDefault ? (
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={pending}
                          onClick={() =>
                            run(
                              async () => setDefaultAddressAction(address.id),
                              "Default address updated",
                            )
                          }
                        >
                          Set default
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="tertiary"
                        onClick={() => {
                          setEditingId(address.id);
                        }}
                      >
                        Edit
                      </Button>
                      <ConfirmActionButton
                        type="button"
                        variant="destructive"
                        disabled={pending}
                        confirmTitle="Remove address"
                        confirmBody="Remove this address from your account? Invoices and shipping may still reference archived records."
                        confirmLabel="Remove"
                        onConfirmed={() =>
                          void run(async () => removeAddressAction(address.id), "Address removed")
                        }
                      >
                        Remove
                      </ConfirmActionButton>
                    </div>
                  </div>
                )}
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
