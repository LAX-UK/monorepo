"use client";

import { CatalogMediaCollectionActions } from "@/components/admin/catalog/media";
import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { CategoryPicker } from "@/components/forms/category-picker";
import { ImageGalleryManager } from "@/components/forms/image-gallery-manager";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import { useMediaCollectionUi } from "@/lib/admin/media/use-media-collection-ui";
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
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  categories: CategoryNode[];
  pending: boolean;
  previewUrlByKey: Record<string, string>;
};

function SaleCoverImagesField({
  value,
  onChange,
  disabled,
  previewUrlByKey,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  previewUrlByKey: Record<string, string>;
}) {
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const {
    showAdd,
    showManage,
    addButtonRef,
    manageButtonRef,
    closeAddPanel,
    toggleAdd,
    toggleManage,
  } = useMediaCollectionUi({
    collectionLength: value.length,
    inspectTarget: inspectIndex,
    setInspectTarget: setInspectIndex,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CatalogMediaCollectionActions
          addButtonRef={addButtonRef}
          manageButtonRef={manageButtonRef}
          showAdd={showAdd}
          showManage={showManage}
          onToggleAdd={toggleAdd}
          onToggleManage={toggleManage}
          addLabel="Add cover images"
          manageLabel="Manage"
        />
      </div>
      <ImageGalleryManager
        kind="sale_cover"
        label="Auction cover"
        value={value}
        onChange={onChange}
        maxFiles={20}
        disabled={disabled}
        previewUrlByKey={previewUrlByKey}
        emptyTitle="No cover images yet"
        emptyDescription="Upload cover images, then drag to reorder. The first image is the primary cover."
        showAddPanel={showAdd}
        onCloseAddPanel={closeAddPanel}
        showManage={showManage}
        inspectIndex={inspectIndex}
        onInspectIndex={setInspectIndex}
      />
    </div>
  );
}

export function SaleIdentityStep({ form, categories, pending, previewUrlByKey }: Props) {
  return (
    <div className="space-y-6">
      <CatalogFormSection
        title="Sale details"
        description="Core identifiers that appear across all public-facing materials and the catalog cover."
        collapsible={false}
        anchorId="sale-details"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Sale title</LabelCaps>
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
                <Textarea
                  id="description"
                  rows={4}
                  variant="underline"
                  className="font-body text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CatalogFormSection>

      <CatalogFormSection
        title="Sale media"
        description="Cover image and promotional visuals. Minimum resolution 2000 × 1500 px for print quality."
        collapsible={false}
        anchorId="sale-media"
      >
        <FormField
          control={form.control}
          name="coverImages"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Cover images</LabelCaps>
              </FormLabel>
              <p className="mb-2 font-body text-xs text-on-surface-variant">
                Image 1: desktop hero master. Image 2 (optional): mobile portrait crop. Image 3
                (optional): desktop xl crop for large screens.
              </p>
              <FormControl>
                <SaleCoverImagesField
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                  previewUrlByKey={previewUrlByKey}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CatalogFormSection>

      <CatalogFormSection
        title="Discovery & classification"
        description="Controls how this sale surfaces in collector search, curator filters, and internal reports."
        collapsible={false}
        anchorId="sale-discovery"
      >
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
    </div>
  );
}
