"use client";

import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { ArtistTextField } from "../fields";
import type { ArtistFormSectionProps } from "../types";

export function IdentitySection({ control, disabled = false }: ArtistFormSectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="displayName"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>
              <LabelCaps>Display name</LabelCaps>
            </FormLabel>
            <FormControl>
              <UnderlineInput placeholder="Artist or brand name" {...field} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <LabelCaps>Slug</LabelCaps>
            </FormLabel>
            <FormControl>
              <UnderlineInput
                placeholder="Auto-generated if empty"
                {...field}
                value={field.value ?? ""}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <ArtistTextField
        control={control}
        name="nationality"
        label="Nationality"
        disabled={disabled}
      />
      <ArtistTextField control={control} name="location" label="Location" disabled={disabled} />
    </div>
  );
}
