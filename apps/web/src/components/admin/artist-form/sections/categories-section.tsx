"use client";

import { CategoryPicker } from "@/components/forms/category-picker";
import { LabelCaps } from "@/components/ui/typography";
import type { CategoryNode } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { ArtistFormSectionProps } from "../types";

/** Department (category) multiselect — shares the lot category taxonomy so a
 * creator can be filed under the same collecting domains as their lots. */
export function CategoriesSection({
  control,
  categories,
  disabled: _disabled = false,
}: ArtistFormSectionProps & { categories: CategoryNode[] }) {
  return (
    <FormField
      control={control}
      name="categoryIds"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelCaps>Departments</LabelCaps>
          </FormLabel>
          <FormControl>
            <CategoryPicker
              categories={categories}
              value={field.value ?? []}
              onChange={(next) => field.onChange(next)}
              placeholder="Select collecting departments"
              multiple
            />
          </FormControl>
          <p className="text-xs text-on-surface-variant">
            Used for directory landing pages and faceted browsing. The first selection is treated as
            the primary department.
          </p>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
