"use client";

import { RhfLegalEntityPicker } from "@/components/ui/rhf-legal-entity-picker";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import type { UseFormReturn } from "react-hook-form";
import type { AdminVenueFormValues } from "../venue-form-values";

type Props = {
  form: UseFormReturn<AdminVenueFormValues>;
  mode: "create" | "edit";
  slug?: string | null | undefined;
  /** When true, the legal entity picker is rendered but disabled (archived or sales exist). */
  disableLegalEntityPicker?: boolean;
  /** Display name for the current legal entity in edit mode. */
  legalEntityDisplayName?: string | null | undefined;
};

export function VenueLocationStep({
  form,
  mode,
  slug,
  disableLegalEntityPicker = false,
  legalEntityDisplayName,
}: Props) {
  return (
    <div className="space-y-4">
      {mode === "edit" && slug ? (
        <p className="rounded-md border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-body text-xs text-on-surface-variant">
          Public slug: <span className="font-mono text-on-surface">{slug}</span>
        </p>
      ) : null}

      <FormField
        control={form.control}
        name="legalEntityId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Organisation <span className="text-error">*</span>
            </FormLabel>
            <FormControl>
              <RhfLegalEntityPicker
                value={field.value || null}
                displayLabel={legalEntityDisplayName ?? null}
                onChange={(id) => field.onChange(id ?? "")}
                disabled={disableLegalEntityPicker}
                searchPlaceholder="Search organisation…"
              />
            </FormControl>
            {disableLegalEntityPicker ? (
              <p className="font-body text-xs text-on-surface-variant">
                Organisation cannot be changed while this venue is referenced by sales or archived.
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Venue name <span className="text-error">*</span>
            </FormLabel>
            <FormControl>
              <Input {...field} placeholder="e.g. Main Gallery" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="addressLine1"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Address line 1 <span className="text-error">*</span>
            </FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="addressLine2"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address line 2</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                City <span className="text-error">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="county"
          render={({ field }) => (
            <FormItem>
              <FormLabel>County</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="postcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Postcode <span className="text-error">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>
                Country <span className="text-error">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
