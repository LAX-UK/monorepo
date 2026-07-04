"use client";

import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { useId } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { AddressFormValues } from "./address-board-helpers";

export function AddressFields({ form }: { form: UseFormReturn<AddressFormValues> }) {
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
