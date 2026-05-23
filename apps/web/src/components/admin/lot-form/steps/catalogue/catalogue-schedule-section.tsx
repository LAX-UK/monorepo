"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { LabelCaps } from "@/components/ui/typography";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  fields: Pick<Record<LotCatalogueFieldKey, FieldSpec>, "startTime" | "endTime">;
};

export function CatalogueScheduleSection({ form, fields }: Props) {
  if (!fields.startTime.visible && !fields.endTime.visible) return null;

  return (
    <CatalogFormSection
      title="Schedule"
      description="When bidding opens and closes."
      collapsible={false}
    >
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
                <FormControl>
                  <Input
                    type="datetime-local"
                    className="min-h-11 py-3 font-body text-sm"
                    {...field}
                  />
                </FormControl>
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
                <FormControl>
                  <Input
                    type="datetime-local"
                    className="min-h-11 py-3 font-body text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
      </div>
    </CatalogFormSection>
  );
}
