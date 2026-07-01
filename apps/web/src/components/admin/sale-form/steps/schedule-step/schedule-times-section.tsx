import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { RhfDateTimePicker } from "@/components/ui/rhf-date-time-picker";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@auction/ui/components/form";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  isSaleroom: boolean;
};

export function ScheduleTimesSection({ form, isDraft, isSaleroom }: Props) {
  return (
    <CatalogFormSection
      title="Schedule"
      description="Sale window and optional preview start."
      collapsible={false}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Start (London)</LabelCaps>
              </FormLabel>
              <RhfDateTimePicker
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={!isDraft}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="endTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>End (London)</LabelCaps>
              </FormLabel>
              <RhfDateTimePicker
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={!isDraft}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {isSaleroom ? (
        <p className="-mt-4 font-body text-xs text-on-surface-variant">
          For onsite and hybrid auctions the start/end window controls the entire event. All lots in
          this auction will share these times automatically.
        </p>
      ) : null}

      <FormField
        control={form.control}
        name="previewStartTime"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <LabelCaps>Preview start (optional)</LabelCaps>
            </FormLabel>
            <RhfDateTimePicker
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={!isDraft}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </CatalogFormSection>
  );
}
