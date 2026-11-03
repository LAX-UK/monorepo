"use client";

import type { StepProps } from "@/components/dashboard/submission-wizard/step-props";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { Textarea } from "@auction/ui/components/textarea";
import { Checkbox } from "@auction/ui/lax";

export function DetailsStep({ form }: StepProps) {
  return (
    <div className="space-y-6" data-testid="submission-wizard-step-details">
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="medium"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medium (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Oil on canvas" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dimensions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dimensions (optional)</FormLabel>
              <FormControl>
                <Input placeholder="120 × 80 cm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="isSigned"
        render={({ field }) => (
          <FormItem className="flex items-center gap-3">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            </FormControl>
            <FormLabel className="font-body text-sm">The work is signed</FormLabel>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="signatureNote"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Signature note (optional)</FormLabel>
            <FormControl>
              <Input placeholder="Signed lower right, verso label…" {...field} />
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
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                rows={5}
                className="font-body text-sm"
                placeholder="Subject, materials, and any catalogue notes for specialists."
                autoCapitalize="sentences"
                enterKeyHint="done"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
