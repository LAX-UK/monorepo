"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { RhfDateTimePicker } from "@/components/ui/rhf-date-time-picker";
import { LabelCaps } from "@/components/ui/typography";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import {
  parseSaleWindowFromSale,
  proposeLotTimesWithinWindow,
} from "@/lib/admin/sale-lot-window-sync";
import { attachLotScheduleConflictBanner } from "@/lib/admin/sale-setup/field-copy";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { Sale } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { FormField, FormItem, FormLabel, FormMessage } from "@auction/ui/components/form";
import {
  formatDatetimeDisplayHuman,
  instantFromDatetimeFormString,
  toDatetimeFormString,
} from "@auction/ui/lib/datetime";
import { lotTimingViolationAgainstSale, saleModeInheritsLotTiming } from "@auction/validators";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

type SaleOption = Pick<Sale, "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime">;

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  fields: Pick<Record<LotCatalogueFieldKey, FieldSpec>, "startTime" | "endTime">;
  sales: SaleOption[];
};

export function CatalogueScheduleSection({ form, fields, sales }: Props) {
  const saleId = form.watch("saleId");
  const startTimeRaw = form.watch("startTime");
  const endTimeRaw = form.watch("endTime");
  const sale = sales.find((s) => s.id === saleId) ?? null;
  const inheritsTiming = sale ? saleModeInheritsLotTiming(sale.deliveryMode) : false;

  useEffect(() => {
    if (!sale || !inheritsTiming) return;
    const window = parseSaleWindowFromSale(sale);
    const lotStart = startTimeRaw?.trim()
      ? instantFromDatetimeFormString(startTimeRaw)
      : sale.startTime;
    const lotEnd = endTimeRaw?.trim() ? instantFromDatetimeFormString(endTimeRaw) : sale.endTime;
    const violation = lotTimingViolationAgainstSale(window, lotStart, lotEnd);
    if (!violation) return;
    const proposed = proposeLotTimesWithinWindow({ startTime: lotStart, endTime: lotEnd }, window);
    const nextStart = toDatetimeFormString(proposed.startTime);
    const nextEnd = toDatetimeFormString(proposed.endTime);
    if (startTimeRaw === nextStart && endTimeRaw === nextEnd) return;
    form.setValue("startTime", nextStart, { shouldDirty: false, shouldValidate: true });
    form.setValue("endTime", nextEnd, { shouldDirty: false, shouldValidate: true });
  }, [endTimeRaw, form, inheritsTiming, sale, startTimeRaw]);

  if (!fields.startTime.visible && !fields.endTime.visible) return null;

  const saleWindowLabel =
    sale != null
      ? `${formatDatetimeDisplayHuman(toDatetimeFormString(sale.startTime))} – ${formatDatetimeDisplayHuman(toDatetimeFormString(sale.endTime))}`
      : null;

  let scheduleViolation: string | null = null;
  if (sale && !inheritsTiming && startTimeRaw?.trim() && endTimeRaw?.trim()) {
    const lotStart = instantFromDatetimeFormString(startTimeRaw);
    const lotEnd = instantFromDatetimeFormString(endTimeRaw);
    if (!Number.isNaN(lotStart.getTime()) && !Number.isNaN(lotEnd.getTime())) {
      scheduleViolation = lotTimingViolationAgainstSale(
        parseSaleWindowFromSale(sale),
        lotStart,
        lotEnd,
      );
    }
  }

  function syncToSaleWindow() {
    if (!sale) return;
    const window = parseSaleWindowFromSale(sale);
    const lotStart = startTimeRaw?.trim()
      ? instantFromDatetimeFormString(startTimeRaw)
      : sale.startTime;
    const lotEnd = endTimeRaw?.trim() ? instantFromDatetimeFormString(endTimeRaw) : sale.endTime;
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

  return (
    <CatalogFormSection
      title="Schedule"
      description={
        inheritsTiming
          ? "This lot inherits the sale opening and closing times."
          : "When bidding opens and closes. Lot times must fall within the sale window."
      }
      collapsible={false}
    >
      {saleWindowLabel ? (
        <p className="font-body text-sm text-on-surface-variant">
          Sale window (London): <span className="text-on-surface">{saleWindowLabel}</span>
        </p>
      ) : null}

      {inheritsTiming && sale ? (
        <p className="rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
          Opens {formatDatetimeDisplayHuman(toDatetimeFormString(sale.startTime))} and closes{" "}
          {formatDatetimeDisplayHuman(toDatetimeFormString(sale.endTime))} — matching the sale
          schedule. Lot times sync automatically when they drift from the sale window.
        </p>
      ) : null}

      {scheduleViolation ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-3">
            <p>{attachLotScheduleConflictBanner()}</p>
            <Button type="button" size="sm" variant="outline" onClick={syncToSaleWindow}>
              Sync to sale window
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!inheritsTiming ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {fields.startTime.visible ? (
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>{fields.startTime.label}</LabelCaps>
                  </FormLabel>
                  <RhfDateTimePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          {fields.endTime.visible ? (
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>{fields.endTime.label}</LabelCaps>
                  </FormLabel>
                  <RhfDateTimePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>
      ) : null}
    </CatalogFormSection>
  );
}
