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

type Props = ArtistFormSectionProps & {
  mode: "create" | "edit";
  /** Read-only slug shown on edit (server-generated at create). */
  slug?: string;
};

export function IdentitySection({ control, mode, slug, disabled = false }: Props) {
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
      {mode === "edit" && slug ? (
        <div className="sm:col-span-2">
          <p className="mb-2 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Slug
          </p>
          <p className="font-mono text-sm text-on-surface">/{slug}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Generated at creation and cannot be changed.
          </p>
        </div>
      ) : null}
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
