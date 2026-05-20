"use client";

import { lotMarketingSection } from "@/components/sections/artwork/lot-marketing-sections";
import type { AdminLotMarketingFormValues } from "@/lib/admin/admin-lot-marketing-mappers";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminLotMarketingFormValues>;
};

export function LotMarketingArtistStoryStep({ form }: Props) {
  return (
    <section className="space-y-4">
      <h3 className="font-label text-sm font-semibold text-on-surface">
        {lotMarketingSection.artist.title}
      </h3>
      <FormField
        control={form.control}
        name="artistNote"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-xs uppercase">Note</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                rows={5}
                className="min-h-0"
                placeholder="Per-lot artist blurb; complements the public profile when set."
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
