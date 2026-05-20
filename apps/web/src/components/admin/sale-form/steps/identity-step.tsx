"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { CategoryPicker } from "@/components/forms/category-picker";
import { ImageGalleryManager } from "@/components/forms/image-gallery-manager";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { CategoryNode } from "@auction/types";
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
  form: UseFormReturn<AdminSaleFormValues>;
  categories: CategoryNode[];
  pending: boolean;
  previewUrlByKey: Record<string, string>;
};

export function SaleIdentityStep({ form, categories, pending, previewUrlByKey }: Props) {
  return (
    <CatalogFormSection
      title="Identity & discovery"
      description="Title, description, cover art, and optional theme category."
      collapsible={false}
    >
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="mb-2 block">
              <LabelCaps>Title</LabelCaps>
            </FormLabel>
            <FormControl>
              <UnderlineInput placeholder="Sale title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="mb-2 block">
              <LabelCaps>Description</LabelCaps>
            </FormLabel>
            <FormControl>
              <Textarea id="description" rows={4} className="font-body text-sm" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="coverImages"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="mb-2 block">
              <LabelCaps>Cover images</LabelCaps>
            </FormLabel>
            <p className="mb-2 font-body text-xs text-on-surface-variant">
              The first image is shown as the primary auction cover on listing pages.
            </p>
            <FormControl>
              <ImageGalleryManager
                kind="sale_cover"
                label="Auction cover"
                value={field.value}
                onChange={field.onChange}
                maxFiles={20}
                disabled={pending}
                previewUrlByKey={previewUrlByKey}
                emptyTitle="No cover images yet"
                emptyDescription="Upload cover images, then drag to reorder. The first image is the primary cover."
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="mb-2 block">
              <LabelCaps>Theme category</LabelCaps>
            </FormLabel>
            <FormControl>
              <CategoryPicker
                categories={categories}
                value={field.value ? [field.value] : []}
                onChange={(next) => field.onChange(next[0] ?? "")}
                placeholder="Select a category (optional)"
                multiple={false}
              />
            </FormControl>
            <p className="mt-2 font-body text-xs text-on-surface-variant">
              Optional theme used for public sale discovery and internal filtering.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </CatalogFormSection>
  );
}
