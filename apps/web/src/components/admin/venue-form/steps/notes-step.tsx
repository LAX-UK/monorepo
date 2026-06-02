"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import type { UseFormReturn } from "react-hook-form";
import type { AdminVenueFormValues } from "../index";

type Props = {
  form: UseFormReturn<AdminVenueFormValues>;
};

export function VenueNotesStep({ form }: Props) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="accessNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Access notes</FormLabel>
            <FormControl>
              <Textarea {...field} rows={3} placeholder="Door codes, accessibility information…" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="parkingNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Parking notes</FormLabel>
            <FormControl>
              <Textarea {...field} rows={3} placeholder="Nearby car parks, restrictions…" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="directionsNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Directions notes</FormLabel>
            <FormControl>
              <Textarea {...field} rows={3} placeholder="From the station, nearest tube…" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="photos"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Photo URLs</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                rows={3}
                placeholder="https://example.com/photo-1.jpg, https://example.com/photo-2.jpg"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
