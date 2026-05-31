"use client";

import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import { type ArtistKind, getCreatorKindConfig } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import type { FieldPath } from "react-hook-form";
import type { ArtistFormSectionProps, ArtistFormValues } from "../types";

/** Renders the kind-specific attribute fields declared in the creator-kind
 * config. Adding a new kind/attribute changes nothing here (OCP) — the section
 * iterates the config and binds each field to `attributes.<key>`. */
export function AttributesSection({
  control,
  kind = "artist",
  disabled = false,
}: ArtistFormSectionProps & { kind?: ArtistKind }) {
  const config = getCreatorKindConfig(kind);
  if (config.attributes.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">
        No additional attributes for {config.label.toLowerCase()} profiles.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {config.attributes.map((attr) => {
        const name = `attributes.${attr.key}` as FieldPath<ArtistFormValues>;
        return (
          <FormField
            key={attr.key}
            control={control}
            name={name}
            render={({ field }) => (
              <FormItem className={attr.type === "textarea" ? "sm:col-span-2" : undefined}>
                <FormLabel>
                  <LabelCaps>{attr.label}</LabelCaps>
                </FormLabel>
                <FormControl>
                  {attr.type === "textarea" ? (
                    <Textarea
                      {...field}
                      value={typeof field.value === "string" ? field.value : ""}
                      rows={3}
                      disabled={disabled}
                    />
                  ) : (
                    <UnderlineInput
                      {...field}
                      value={typeof field.value === "string" ? field.value : ""}
                      disabled={disabled}
                    />
                  )}
                </FormControl>
                {attr.help ? <p className="text-xs text-on-surface-variant">{attr.help}</p> : null}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      })}
    </div>
  );
}
