"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { LabelCaps } from "@/components/ui/typography";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import type { adminCategoryFormSchema } from "@auction/validators";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

type CategoryFormValues = z.infer<typeof adminCategoryFormSchema>;

type Props = {
  form: UseFormReturn<CategoryFormValues>;
  mode: "create" | "edit";
};

export function CategoryPresentationStep({ form, mode }: Props) {
  return (
    <>
      <CatalogFormSection
        title="Hero image"
        description="Optional banner for the public category page."
        collapsible={false}
      >
        <FormField
          control={form.control}
          name="heroImageKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Hero image</LabelCaps>
              </FormLabel>
              <FormControl>
                <ImageUploadField
                  kind="category_image"
                  value={field.value ? [field.value] : []}
                  onChange={(keys) => field.onChange(keys[0] ?? null)}
                />
              </FormControl>
              <p className="text-xs text-on-surface-variant">
                Optional banner image displayed on the category landing page.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </CatalogFormSection>

      {mode === "edit" ? (
        <CatalogFormSection
          title="Status"
          description="Archive without deleting."
          collapsible={false}
        >
          <FormField
            control={form.control}
            name="archived"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-outline-variant/40 p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="mb-2 block">
                    <LabelCaps>Archived</LabelCaps>
                  </FormLabel>
                  <p className="font-body text-xs text-on-surface-variant">
                    Archived categories stay in history but are hidden from default pickers.
                  </p>
                </div>
              </FormItem>
            )}
          />
        </CatalogFormSection>
      ) : null}

      <CatalogFormSection title="Description" collapsible={false}>
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
                  rows={5}
                  placeholder="Internal description or public category copy"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CatalogFormSection>
    </>
  );
}
