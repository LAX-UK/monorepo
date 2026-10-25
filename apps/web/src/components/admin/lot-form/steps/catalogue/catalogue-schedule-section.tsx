"use client";

import { StaffDateTimeField } from "@/components/admin/forms/staff-form-fields";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import {
  parseSaleWindowFromSale,
  proposeLotTimesWithinWindow,
} from "@/lib/admin/sale-lot-window-sync";
import { attachLotScheduleConflictBanner } from "@/lib/admin/sale-setup/field-copy";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { FieldRow, FormSection, Notice, StaffButton, formatStaffDateTime } from "@auction/staff-ui";
import type { Sale } from "@auction/types";
import { instantFromDatetimeFormString, toDatetimeFormString } from "@auction/ui/lib/datetime";
import { lotTimingViolationAgainstSale, saleModeInheritsLotTiming } from "@auction/validators";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { LOT_FORM_ID, lotFieldProps } from "../../lot-field-spec";

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
      ? `${formatStaffDateTime(sale.startTime, { zoneLabel: true })} to ${formatStaffDateTime(sale.endTime, { zoneLabel: true })}`
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
    <FormSection
      title="Schedule"
      description={
        inheritsTiming
          ? "This lot takes its sale's opening and closing times."
          : "When bidding opens and closes. The times must fall inside the sale's window."
      }
    >
      {sale ? (
        <Notice tone="info" title={inheritsTiming ? "Times follow the sale" : "Sale window"}>
          {saleWindowLabel}
          {inheritsTiming ? ". The lot's times move with the sale's." : null}
        </Notice>
      ) : null}
      {scheduleViolation ? (
        <Notice
          tone="danger"
          title="The lot closes outside its sale"
          actions={
            <StaffButton type="button" size="sm" variant="secondary" onClick={syncToSaleWindow}>
              Sync to sale window
            </StaffButton>
          }
        >
          {attachLotScheduleConflictBanner()}
        </Notice>
      ) : null}
      {!inheritsTiming ? (
        <FieldRow>
          {fields.startTime.visible ? (
            <StaffDateTimeField
              control={form.control}
              name="startTime"
              formId={LOT_FORM_ID}
              {...lotFieldProps(fields.startTime)}
            />
          ) : null}
          {fields.endTime.visible ? (
            <StaffDateTimeField
              control={form.control}
              name="endTime"
              formId={LOT_FORM_ID}
              {...lotFieldProps(fields.endTime)}
            />
          ) : null}
        </FieldRow>
      ) : null}
    </FormSection>
  );
}
