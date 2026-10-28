"use client";

import { CurrencyInput } from "@/components/dashboard/submission-wizard/currency-input";
import type { StepProps } from "@/components/dashboard/submission-wizard/step-props";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";

export function PricingStep({ form }: StepProps) {
  return (
    <div className="space-y-6" data-testid="submission-wizard-step-pricing">
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="askingPrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asking price (optional)</FormLabel>
              <p className="mb-1 font-body text-xs text-on-surface-variant">
                For specialist context only — not shown to bidders until published as a lot.
              </p>
              <FormControl>
                <CurrencyInput placeholder="0.00" value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reservePrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reserve (optional)</FormLabel>
              <FormControl>
                <CurrencyInput placeholder="0.00" value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="conditionSelfReport"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Condition</FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                className="font-body text-sm"
                placeholder="Marks, repairs, framing, or conservation notes."
                autoCapitalize="sentences"
                enterKeyHint="next"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="submitterNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes for reviewers</FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                className="font-body text-sm"
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
