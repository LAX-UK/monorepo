import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { formatNumber } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormReturn,
} from "react-hook-form";
import type { TierPreview } from "./types";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  fields: FieldArrayWithId<AdminSaleFormValues, "buyerPremiumTiers", "id">[];
  append: UseFieldArrayAppend<AdminSaleFormValues, "buyerPremiumTiers">;
  remove: UseFieldArrayRemove;
  tierBandPreview: TierPreview;
};

export function BuyerPremiumSection({
  form,
  isDraft,
  fields,
  append,
  remove,
  tierBandPreview,
}: Props) {
  return (
    <CatalogFormSection
      title="Buyer premium"
      description="Flat rate and optional tier bands (draft only)."
      collapsible={false}
    >
      <FormField
        control={form.control}
        name="buyerPremiumRate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <LabelCaps>Buyer premium (0–1)</LabelCaps>
            </FormLabel>
            <FormControl>
              <UnderlineInput
                id="buyerPremiumRate"
                placeholder="0.25"
                disabled={!isDraft}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-4 rounded-md border border-outline-variant/30 bg-surface-container-low/40 p-4">
        <div>
          <p className="font-label text-[0.65rem] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Buyer premium bands (optional)
          </p>
          <p className="mt-1 font-body text-xs text-on-surface-variant">
            Leave empty for a single flat rate (field above). When bands exist, the rate for the
            whole hammer is the one on the highest threshold still at or below the hammer
            (band-based, not progressive). The first band always starts at £0.
          </p>
        </div>
        {fields.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isDraft}
            onClick={() => append({ hammerThresholdMajor: "0", rate: "" })}
          >
            Add tier bands
          </Button>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-wrap items-end gap-3 border-b border-border-hairline pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-[160px] flex-1">
                  {index === 0 ? (
                    <p className="pb-2 font-body text-xs text-on-surface-variant">From £0</p>
                  ) : (
                    <FormField
                      control={form.control}
                      name={`buyerPremiumTiers.${index}.hammerThresholdMajor`}
                      render={({ field: tierField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">From (£, major units)</FormLabel>
                          <FormControl>
                            <UnderlineInput
                              placeholder="e.g. 500000 for £500k"
                              disabled={!isDraft}
                              {...tierField}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                <FormField
                  control={form.control}
                  name={`buyerPremiumTiers.${index}.rate`}
                  render={({ field: tierField }) => (
                    <FormItem className="min-w-[120px] flex-1">
                      <FormLabel className="text-xs">Rate (0–1)</FormLabel>
                      <FormControl>
                        <UnderlineInput placeholder="0.15" disabled={!isDraft} {...tierField} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-error"
                  disabled={!isDraft}
                  onClick={() => remove(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ hammerThresholdMajor: "", rate: "" })}
                disabled={!isDraft || fields.length >= 16}
              >
                Add band
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!isDraft}
                onClick={() => form.setValue("buyerPremiumTiers", [])}
              >
                Remove all bands
              </Button>
            </div>
          </div>
        )}
        {tierBandPreview.ok ? (
          <div className="rounded border border-dashed border-outline-variant/50 p-3 font-body text-xs text-on-surface-variant">
            <p className="font-medium text-on-surface">
              Preview — {tierBandPreview.kind === "tiered" ? "tiered" : "flat"} policy
            </p>
            <p className="mt-1">
              £{formatNumber(Number(tierBandPreview.at250k.hammer), undefined, "en-GB")} hammer →
              buyer premium £{tierBandPreview.at250k.premium}
            </p>
            <p>
              £{formatNumber(Number(tierBandPreview.at600k.hammer), undefined, "en-GB")} hammer →
              premium £{tierBandPreview.at600k.premium}
            </p>
          </div>
        ) : null}
      </div>
    </CatalogFormSection>
  );
}
