"use client";

import { LabelCaps } from "@/components/ui/typography";
import type { ArtistKind, ArtistStatus } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { useId } from "react";
import { KindSelector } from "../kind-selector";
import type { ArtistFormSectionProps } from "../types";

const ARTIST_STATUS_OPTIONS: ReadonlyArray<{ value: ArtistStatus; label: string }> = [
  { value: "approved", label: "Approved (visible to public)" },
  { value: "pending", label: "Pending review" },
  { value: "rejected", label: "Rejected (hidden)" },
];

export function CatalogueSection({ control, disabled = false }: ArtistFormSectionProps) {
  const kindGroupLabelId = useId();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FormField
        control={control}
        name="kind"
        render={({ field }) => (
          <FormItem>
            <FormLabel id={kindGroupLabelId}>
              <LabelCaps>Kind</LabelCaps>
            </FormLabel>
            <FormControl>
              <KindSelector
                value={(field.value as ArtistKind | undefined) ?? "artist"}
                onChange={(k) => field.onChange(k)}
                onBlur={field.onBlur}
                disabled={disabled}
                aria-labelledby={kindGroupLabelId}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <LabelCaps>Status</LabelCaps>
            </FormLabel>
            <FormControl>
              <select
                value={field.value ?? "approved"}
                disabled={disabled}
                onChange={(event) => field.onChange(event.target.value as ArtistStatus)}
                onBlur={field.onBlur}
                className="min-h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
              >
                {ARTIST_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormControl>
            <p className="text-xs text-on-surface-variant">
              Approved profiles appear in the public directory. Pending hides the profile and flags
              attached lots for review.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
