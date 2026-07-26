import { LabelCaps } from "@/components/ui/typography";
import { deliveryModeExplanation, deliveryModeLabel } from "@/lib/admin/sale-setup/field-copy";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { SaleDeliveryMode } from "@auction/types";
import { saleDeliveryModes } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
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

const DELIVERY_MODE_HEADINGS: Record<SaleDeliveryMode, string> = {
  online: "Online (timed auction)",
  hybrid: "Hybrid (in-room + online)",
  onsite: "Live (real-time saleroom)",
};

export function DeliveryModeField({ form, isDraft, deliveryMode }: Props) {
  const activeMode = (deliveryMode ?? "online") as SaleDeliveryMode;

  return (
    <>
      <FormField
        control={form.control}
        name="deliveryMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <LabelCaps>Auction format</LabelCaps>
            </FormLabel>
            <FormControl>
              <div className="grid gap-3 sm:grid-cols-3">
                {saleDeliveryModes.map((mode) => {
                  const selected = field.value === mode;
                  return (
                    <Button
                      key={mode}
                      type="button"
                      variant="ghost"
                      disabled={!isDraft}
                      onClick={() => {
                        if (isDraft) field.onChange(mode);
                      }}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-colors",
                        selected
                          ? "border-secondary bg-secondary/5 ring-1 ring-secondary/30"
                          : "border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant/60",
                        !isDraft && "cursor-not-allowed opacity-70",
                      )}
                    >
                      <span className="block font-headline text-sm text-on-surface">
                        {DELIVERY_MODE_HEADINGS[mode]}
                      </span>
                      <span className="mt-1 block font-body text-xs text-on-surface-variant">
                        {deliveryModeLabel(mode)}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </FormControl>
            <p className="mt-2 font-body text-xs text-on-surface-variant">
              {deliveryModeExplanation(activeMode)}
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
