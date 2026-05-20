"use client";

import { AdminLegalEntityPicker } from "@/components/admin/admin-legal-entity-picker";
import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { Sale } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { UseFormReturn } from "react-hook-form";

type SaleOption = Pick<Sale, "id" | "title" | "status">;

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  sales: SaleOption[];
};

export function LotSaleSellerStep({ form, sales }: Props) {
  return (
    <CatalogFormSection
      title="Sale & seller"
      description="Assign the owning legal entity and optional sale / paddle number."
      collapsible={false}
    >
      <FormField
        control={form.control}
        name="sellerLegalEntityId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <LabelCaps>Seller (legal entity)</LabelCaps>
            </FormLabel>
            <FormControl>
              <AdminLegalEntityPicker
                value={field.value || null}
                displayLabel={form.watch("sellerDisplayName") ?? null}
                onChange={(id, row) => {
                  field.onChange(id ?? "");
                  if (row) form.setValue("sellerDisplayName", row.displayName);
                }}
              />
            </FormControl>
            <p className="mt-2 font-body text-xs text-on-surface-variant">
              The legal entity that owns this lot and receives payout.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="saleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Assign to sale (optional)</LabelCaps>
              </FormLabel>
              <select
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                className="mt-1 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body text-sm"
              >
                <option value="">— No sale —</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.status})
                  </option>
                ))}
              </select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lotNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Lot number (optional)</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  type="number"
                  min={1}
                  placeholder="e.g. 42"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </CatalogFormSection>
  );
}
