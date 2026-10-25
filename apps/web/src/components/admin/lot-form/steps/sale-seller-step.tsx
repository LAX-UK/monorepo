"use client";

import { StaffEntityField, StaffTextField } from "@/components/admin/forms/staff-form-fields";
import { searchLegalEntityOptions } from "@/lib/admin/pickers/staff-entity-search";
import {
  parseSaleWindowFromSale,
  proposeLotTimesWithinWindow,
} from "@/lib/admin/sale-lot-window-sync";
import { draftSaleLotPublishBanner } from "@/lib/admin/sale-setup/field-copy";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import { FieldRow, FormSection, Notice, StaffButton, formatStaffDate } from "@auction/staff-ui";
import type { Sale } from "@auction/types";
import { instantFromDatetimeFormString, toDatetimeFormString } from "@auction/ui/lib/datetime";
import { saleModeInheritsLotTiming } from "@auction/validators";
import Link from "next/link";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { LOT_FORM_ID } from "../lot-field-spec";

type SaleOption = Pick<Sale, "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime">;

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  sales: SaleOption[];
};

function applySaleScheduleToLot(form: UseFormReturn<AdminLotFormValues>, sale: SaleOption) {
  const window = parseSaleWindowFromSale(sale);
  const set = (name: "startTime" | "endTime", value: Date) =>
    form.setValue(name, toDatetimeFormString(value), { shouldDirty: true, shouldValidate: true });
  if (saleModeInheritsLotTiming(sale.deliveryMode)) {
    set("startTime", sale.startTime);
    set("endTime", sale.endTime);
    return;
  }
  const startRaw = form.getValues("startTime");
  const endRaw = form.getValues("endTime");
  const lotStart = startRaw?.trim() ? instantFromDatetimeFormString(startRaw) : sale.startTime;
  const lotEnd = endRaw?.trim() ? instantFromDatetimeFormString(endRaw) : sale.endTime;
  const proposed = proposeLotTimesWithinWindow({ startTime: lotStart, endTime: lotEnd }, window);
  set("startTime", proposed.startTime);
  set("endTime", proposed.endTime);
}

/**
 * Who owns the lot and which sale it is in. Only draft sales can take a new lot; a lot already in
 * a published sale shows its sale read-only, since moving it means returning it to inventory.
 */
export function LotSaleSellerStep({ form, sales }: Props) {
  const sellerDisplayName = useWatch({ control: form.control, name: "sellerDisplayName" });
  const sellerId = useWatch({ control: form.control, name: "sellerLegalEntityId" });
  const selectedSaleId = useWatch({ control: form.control, name: "saleId" });
  const selectedSale = sales.find((sale) => sale.id === selectedSaleId) ?? null;
  const locked = selectedSale != null && selectedSale.status !== "draft";
  const draftSales = sales.filter((sale) => sale.status === "draft");

  return (
    <FormSection
      title="Sale and seller"
      description="The legal entity that owns the lot and is paid for it, and the sale it is in. Online lots close inside the sale's window; saleroom lots take the sale's times."
    >
      <StaffEntityField
        control={form.control}
        name="sellerLegalEntityId"
        formId={LOT_FORM_ID}
        label="Seller"
        description="The legal entity that owns this lot and receives the payout."
        search={searchLegalEntityOptions}
        selected={
          sellerId && sellerDisplayName?.trim()
            ? { id: sellerId, label: sellerDisplayName.trim() }
            : null
        }
        placeholder="Choose a seller"
        searchPlaceholder="Search by organisation or name"
        emptyText="No legal entities match."
        onChanged={(option) =>
          form.setValue("sellerDisplayName", option?.label ?? "", {
            shouldDirty: true,
            shouldValidate: false,
          })
        }
      />
      {locked && selectedSale ? (
        <>
          <Notice
            tone="info"
            title="This lot is in a published sale"
            actions={
              <StaffButton asChild size="sm" variant="secondary">
                <Link href={`/admin/sales/${selectedSale.id}`}>Open sale</Link>
              </StaffButton>
            }
          >
            {selectedSale.title} is {staffStatus("sale", selectedSale.status).label.toLowerCase()}.
            To move the lot, return it to inventory from the lot's actions first.
          </Notice>
          <StaffTextField
            control={form.control}
            name="lotNumber"
            formId={LOT_FORM_ID}
            label="Lot number"
            optional
            integer
            placeholder="e.g. 42"
          />
        </>
      ) : (
        <FieldRow>
          <StaffEntityField
            control={form.control}
            name="saleId"
            formId={LOT_FORM_ID}
            label="Sale"
            description={
              draftSales.length === 0
                ? "No draft sales yet. Create a sale first to add this lot to it."
                : selectedSale
                  ? draftSaleLotPublishBanner()
                  : "Only draft sales can take a new lot."
            }
            options={draftSales.map((sale) => ({
              id: sale.id,
              label: sale.title,
              description: [
                deliveryModeShortLabel(sale.deliveryMode),
                formatStaffDate(sale.startTime),
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
            placeholder="Choose a draft sale"
            searchPlaceholder="Search draft sales"
            emptyText="No draft sales match."
            onChanged={(option) => {
              const sale = option ? sales.find((item) => item.id === option.id) : null;
              if (sale) applySaleScheduleToLot(form, sale);
            }}
          />
          <StaffTextField
            control={form.control}
            name="lotNumber"
            formId={LOT_FORM_ID}
            label="Lot number"
            optional
            integer
            placeholder="e.g. 42"
          />
        </FieldRow>
      )}
    </FormSection>
  );
}
