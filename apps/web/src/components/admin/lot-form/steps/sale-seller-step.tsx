"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { UnderlineInput } from "@/components/ui/input";
import { RhfCombobox } from "@/components/ui/rhf-combobox";
import { RhfLegalEntityPicker } from "@/components/ui/rhf-legal-entity-picker";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import {
  parseSaleWindowFromSale,
  proposeLotTimesWithinWindow,
} from "@/lib/admin/sale-lot-window-sync";
import { draftSaleLotPublishBanner } from "@/lib/admin/sale-setup/field-copy";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { Sale } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { instantFromDatetimeFormString, toDatetimeFormString } from "@auction/ui/lib/datetime";
import { saleModeInheritsLotTiming } from "@auction/validators";
import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";

type SaleOption = Pick<Sale, "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime">;

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  sales: SaleOption[];
};

const SALE_COMBOBOX_THRESHOLD = 20;

function applySaleScheduleToLot(form: UseFormReturn<AdminLotFormValues>, sale: SaleOption) {
  const window = parseSaleWindowFromSale(sale);
  if (saleModeInheritsLotTiming(sale.deliveryMode)) {
    form.setValue("startTime", toDatetimeFormString(sale.startTime), {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("endTime", toDatetimeFormString(sale.endTime), {
      shouldDirty: true,
      shouldValidate: true,
    });
    return;
  }

  const startRaw = form.getValues("startTime");
  const endRaw = form.getValues("endTime");
  const lotStart = startRaw?.trim() ? instantFromDatetimeFormString(startRaw) : sale.startTime;
  const lotEnd = endRaw?.trim() ? instantFromDatetimeFormString(endRaw) : sale.endTime;
  const proposed = proposeLotTimesWithinWindow({ startTime: lotStart, endTime: lotEnd }, window);
  form.setValue("startTime", toDatetimeFormString(proposed.startTime), {
    shouldDirty: true,
    shouldValidate: true,
  });
  form.setValue("endTime", toDatetimeFormString(proposed.endTime), {
    shouldDirty: true,
    shouldValidate: true,
  });
}

export function LotSaleSellerStep({ form, sales }: Props) {
  const selectedSaleId = form.watch("saleId");
  const selectedSale = sales.find((s) => s.id === selectedSaleId) ?? null;
  const saleAssignmentLocked = selectedSale != null && selectedSale.status !== "draft";

  const pickerSales = sales.filter((s) => s.status === "draft");
  const saleOptions = pickerSales.map((s) => ({
    value: s.id,
    label: `${s.title} (draft)`,
  }));
  const useSaleCombobox = pickerSales.length > SALE_COMBOBOX_THRESHOLD;

  return (
    <CatalogFormSection
      title="Sale & seller"
      description="Assign the owning legal entity and the sale this lot belongs to. Online lots must fall within the sale window; onsite lots inherit the sale schedule."
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
            <RhfLegalEntityPicker
              value={field.value || null}
              displayLabel={form.watch("sellerDisplayName") ?? null}
              onChange={(id, row) => {
                field.onChange(id ?? "");
                if (row) form.setValue("sellerDisplayName", row.displayName);
              }}
            />
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
          render={({ field }) => {
            function onSaleChange(nextSaleId: string) {
              field.onChange(nextSaleId);
              const sale = sales.find((s) => s.id === nextSaleId);
              if (sale) applySaleScheduleToLot(form, sale);
            }

            return (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Assign to sale</LabelCaps>
                </FormLabel>
                {saleAssignmentLocked && selectedSale ? (
                  <div className="mt-1 space-y-2">
                    <p className="font-body text-sm text-on-surface">
                      {selectedSale.title}{" "}
                      <span className="text-on-surface-variant">({selectedSale.status})</span>
                    </p>
                    <p className="font-body text-xs text-on-surface-variant">
                      This lot is attached to a published sale. Reassigning requires auction ops to
                      return the lot to inventory first.
                    </p>
                    <Link
                      href={`/admin/sales/${selectedSale.id}`}
                      className="font-body text-xs text-primary hover:underline"
                    >
                      View sale →
                    </Link>
                  </div>
                ) : useSaleCombobox ? (
                  <RhfCombobox
                    value={field.value || ""}
                    onChange={onSaleChange}
                    onBlur={field.onBlur}
                    placeholder="Select a draft sale"
                    options={saleOptions}
                    className="mt-1 w-full font-body text-sm"
                  />
                ) : (
                  <RhfSelect
                    value={field.value || ""}
                    onValueChange={onSaleChange}
                    onBlur={field.onBlur}
                    placeholder="Select a draft sale"
                    options={saleOptions}
                    triggerClassName="mt-1 w-full font-body text-sm"
                  />
                )}
                {pickerSales.length === 0 && !saleAssignmentLocked ? (
                  <p className="mt-2 font-body text-xs text-on-surface-variant">
                    No draft sales are available yet.{" "}
                    <Link href="/admin/sales/new" className="text-primary hover:underline">
                      Create a sale
                    </Link>{" "}
                    first, then return to assign this lot.
                  </p>
                ) : null}
                {selectedSale?.status === "draft" ? (
                  <Alert className="mt-3">
                    <AlertDescription className="space-y-2 font-body text-xs">
                      <p>{draftSaleLotPublishBanner()}</p>
                      <Link
                        href={`/admin/sales/${selectedSale.id}/setup?step=review`}
                        className="text-primary hover:underline"
                      >
                        Open sale setup to publish →
                      </Link>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <FormMessage />
              </FormItem>
            );
          }}
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
