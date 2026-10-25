import { StaffCheckboxField, StaffRadioField } from "@/components/admin/forms/staff-form-fields";
import { deliveryModeExplanation } from "@/lib/admin/sale-setup/field-copy";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { SaleDeliveryMode } from "@auction/types";
import { saleDeliveryModes } from "@auction/types";
import type { UseFormReturn } from "react-hook-form";
import { SALE_FORM_ID } from "../../sale-form-id";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  deliveryMode: AdminSaleFormValues["deliveryMode"];
};

const FORMAT_LABELS: Record<SaleDeliveryMode, string> = {
  online: "Online, timed",
  hybrid: "Hybrid, in the room and online",
  onsite: "Live in the saleroom",
};

/** How the sale runs, each format with what it means for bidders and lot times. */
export function DeliveryModeField({ form, isDraft, deliveryMode }: Props) {
  const f = { control: form.control, formId: SALE_FORM_ID, disabled: !isDraft } as const;
  return (
    <>
      <StaffRadioField<AdminSaleFormValues, SaleDeliveryMode>
        {...f}
        name="deliveryMode"
        label="Format"
        options={saleDeliveryModes.map((mode) => ({
          value: mode,
          label: FORMAT_LABELS[mode],
          description: deliveryModeExplanation(mode),
        }))}
      />
      {deliveryMode === "hybrid" ? (
        <StaffCheckboxField
          {...f}
          name="requireSaleroomGoLiveBeforeOnlineBids"
          label="Online bidding waits for the saleroom to go live"
          description="Online bidders can bid only once the clerk opens the saleroom and puts a lot on the block. Turn off to take online bids earlier in the sale window."
        />
      ) : null}
    </>
  );
}
