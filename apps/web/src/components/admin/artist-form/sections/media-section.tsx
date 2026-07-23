"use client";

import { CatalogSingleImageField } from "@/components/admin/catalog/media";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { ArtistTextField } from "../fields";
import type { ArtistFormSectionProps } from "../types";

type Props = ArtistFormSectionProps & {
  previewUrlByKey?: Record<string, string>;
};

export function MediaSection({ control, disabled = false, previewUrlByKey = {} }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="portraitUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-xs uppercase">Portrait</FormLabel>
            <FormControl>
              <CatalogSingleImageField
                kind="artist_image"
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                previewUrlByKey={previewUrlByKey}
                inputId="artist-portrait"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="heroImageUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-xs uppercase">Hero image</FormLabel>
            <FormControl>
              <CatalogSingleImageField
                kind="artist_image"
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                previewUrlByKey={previewUrlByKey}
                inputId="artist-hero"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="sm:col-span-2">
        <ArtistTextField
          control={control}
          name="websiteUrl"
          label="Website URL"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
