import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import { deliveryModeExplanation, deliveryModeLabel } from "@/lib/admin/sale-setup/field-copy";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { saleDeliveryModes } from "@auction/types";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  deliveryMode: AdminSaleFormValues["deliveryMode"];
};

export function DeliveryModeField({ form, isDraft, deliveryMode }: Props) {
  return (
    <>
      <FormField
        control={form.control}
        name="deliveryMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <LabelCaps>Delivery mode</LabelCaps>
            </FormLabel>
            <RhfSelect
              value={field.value ?? ""}
              onValueChange={(v) => {
                if (isDraft) field.onChange(v);
              }}
              onBlur={field.onBlur}
              disabled={!isDraft}
              options={saleDeliveryModes.map((m) => ({
                value: m,
                label: deliveryModeLabel(m),
              }))}
              triggerClassName="w-full font-body text-sm"
            />
            <p className="mt-2 font-body text-xs text-on-surface-variant">
              {deliveryModeExplanation(
                (deliveryMode ?? "online") as (typeof saleDeliveryModes)[number],
              )}
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {deliveryMode === "hybrid" ? (
        <FormField
          control={form.control}
          name="requireSaleroomGoLiveBeforeOnlineBids"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-outline-variant/25 bg-surface-container-lowest/40 p-4">
              <FormControl>
                <Checkbox
                  id="requireSaleroomGoLiveBeforeOnlineBids"
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    if (isDraft) field.onChange(checked === true);
                  }}
                  disabled={!isDraft}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel htmlFor="requireSaleroomGoLiveBeforeOnlineBids" className="font-body">
                  Require Go Live before online bidding
                </FormLabel>
                <p className="font-body text-xs text-on-surface-variant">
                  When enabled (default), online buyers can only bid after the clerk opens the
                  saleroom and puts a lot on the block. Disable to allow early online bidding during
                  the sale window before Go Live.
                </p>
              </div>
            </FormItem>
          )}
        />
      ) : null}
    </>
  );
}
