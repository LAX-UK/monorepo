"use client";

import { UnderlineInput } from "@/components/ui/input";
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
import type { Control } from "react-hook-form";
import type { ArtistFormValues } from "./types";

type ArtistFormControl = Control<ArtistFormValues>;

export function ArtistTextField({
  control,
  name,
  label,
  disabled = false,
}: {
  control: ArtistFormControl;
  name: keyof ArtistFormValues;
  label: string;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelCaps>{label}</LabelCaps>
          </FormLabel>
          <FormControl>
            <UnderlineInput {...field} value={String(field.value ?? "")} disabled={disabled} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function ArtistTextareaField({
  control,
  name,
  label,
  rows,
  disabled = false,
}: {
  control: ArtistFormControl;
  name: keyof ArtistFormValues;
  label: string;
  rows: number;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelCaps>{label}</LabelCaps>
          </FormLabel>
          <FormControl>
            <Textarea
              {...field}
              value={String(field.value ?? "")}
              rows={rows}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function ArtistFlagCheckbox({
  name,
  control,
  disabled = false,
}: {
  name: "featured" | "verified" | "archived";
  control: ArtistFormControl;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-2">
          <FormControl>
            <Checkbox
              checked={field.value === true}
              disabled={disabled}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          </FormControl>
          <FormLabel className="capitalize">{name}</FormLabel>
        </FormItem>
      )}
    />
  );
}
