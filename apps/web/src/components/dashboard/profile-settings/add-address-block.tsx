"use client";

import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import { useCreateAddressController } from "@/lib/forms/profile/use-create-address-controller";
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

export function AddAddressBlock() {
  const { form, onSubmit, isSubmitting } = useCreateAddressController();

  return (
    <div className="space-y-4 rounded-xl border border-border-hairline bg-surface-container-low/30 p-5">
      <h3 className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
        Add new address
      </h3>
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormControl>
                  <UnderlineInput
                    {...field}
                    placeholder="Label (e.g. Home)"
                    className="border-b py-2"
                  />
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
                  <UnderlineInput
                    {...field}
                    placeholder="Address line 1"
                    className="border-b py-2"
                  />
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
                  <UnderlineInput
                    {...field}
                    placeholder="Line 2 (optional)"
                    className="border-b py-2"
                  />
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
                  <UnderlineInput {...field} placeholder="City" className="border-b py-2" />
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
                  <UnderlineInput
                    {...field}
                    placeholder="State / region"
                    className="border-b py-2"
                  />
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
                  <UnderlineInput {...field} placeholder="Postal code" className="border-b py-2" />
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
                  <UnderlineInput {...field} placeholder="Country" className="border-b py-2" />
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
              <FormItem className="flex flex-row items-center gap-2 space-y-0 md:col-span-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                </FormControl>
                <FormLabel className="font-body text-sm font-normal text-on-surface">
                  Set as default shipping address
                </FormLabel>
              </FormItem>
            )}
          />
          <div className="md:col-span-2">
            <Button
              type="submit"
              variant="secondaryOutline"
              disabled={isSubmitting}
              className="min-w-28"
            >
              {isSubmitting ? "Adding…" : "Add address"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
