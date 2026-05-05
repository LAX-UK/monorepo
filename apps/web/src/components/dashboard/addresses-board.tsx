"use client";

import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import {
  createAddressFromValuesAction,
  removeAddressAction,
  setDefaultAddressAction,
  updateAddressFromValuesAction,
} from "@/lib/actions/profile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { createAddressBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
    isDefault: values.isDefault ?? false,
  };
}

function AddressFields({ form }: { form: ReturnType<typeof useForm<AddressFormValues>> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <UnderlineInput {...field} placeholder="Label" />
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
            <FormControl>
              <UnderlineInput {...field} placeholder="Address line 1" />
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
            <FormControl>
              <UnderlineInput {...field} placeholder="Line 2" />
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
            <FormControl>
              <UnderlineInput {...field} placeholder="State / region" />
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
            <FormControl>
              <UnderlineInput {...field} placeholder="Country" />
            </FormControl>
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
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            </FormControl>
            <span className="font-body text-sm text-on-surface">Default address</span>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function AddressForm({
  initialValues,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
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

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

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

export function AddressesBoard({ addresses }: { addresses: ProfileAddressRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        toast.success(success);
        router.refresh();
        return;
      }
      toast.error(result.error ?? "Could not update address");
    });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-sm border-outline-variant/20 shadow-none">
        <CardHeader>
          <CardTitle className="font-label text-xs uppercase tracking-[0.18em]">
            Saved addresses
          </CardTitle>
          <CardDescription>Manage shipping and invoice delivery addresses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {addresses.length === 0 ? (
            <p className="font-body text-sm text-on-surface-variant">No addresses saved yet.</p>
          ) : (
            addresses.map((address) => (
              <div key={address.id} className="rounded-sm border border-outline-variant/20 p-4">
                {editingId === address.id ? (
                  <AddressForm
                    initialValues={addressToForm(address)}
                    pending={pending}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) =>
                      run(
                        async () =>
                          updateAddressFromValuesAction(address.id, normalizeAddress(values)),
                        "Address updated",
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
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          run(async () => removeAddressAction(address.id), "Address removed")
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="rounded-sm border-outline-variant/20 shadow-none">
        <CardHeader>
          <CardTitle className="font-label text-xs uppercase tracking-[0.18em]">
            Add address
          </CardTitle>
          <CardDescription>Add a new shipping address to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddressForm
            initialValues={emptyAddress}
            pending={pending}
            submitLabel={pending ? "Saving..." : "Add address"}
            onSubmit={(values) =>
              run(
                async () => createAddressFromValuesAction(normalizeAddress(values)),
                "Address added",
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
