"use client";

import { ImageUploadField } from "@/components/forms/image-upload-field";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { ArtistTextField } from "../fields";
import type { ArtistFormSectionProps } from "../types";

export function MediaSection({ control, disabled = false }: ArtistFormSectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="portraitUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-xs uppercase">Portrait</FormLabel>
            <FormControl>
              <ImageUploadField
                kind="artist_image"
                multiple={false}
                maxFiles={1}
                value={field.value ? [field.value] : []}
                onChange={(next) => field.onChange(next[0] ?? "")}
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
              <ImageUploadField
                kind="artist_image"
                multiple={false}
                maxFiles={1}
                value={field.value ? [field.value] : []}
                onChange={(next) => field.onChange(next[0] ?? "")}
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
