"use client";

import type { BasicsStepProps } from "@/components/dashboard/submission-wizard/step-props";
import { CategoryPicker } from "@/components/forms/category-picker";
import { SellPrerequisitesInline } from "@/components/marketing/sell-journey/sell-prerequisites-inline";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";

export function BasicsStep({ form, categories }: BasicsStepProps) {
  return (
    <div className="space-y-6" data-testid="submission-wizard-step-basics">
      <SellPrerequisitesInline />
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input placeholder="Work title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="categoryIds"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Categories</FormLabel>
            <FormControl>
              <CategoryPicker
                categories={categories}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="yearOfWork"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Year of work</FormLabel>
              <FormControl>
                <Input
                  placeholder="2024 or circa 1990"
                  inputMode="numeric"
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
          name="edition"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Edition (optional)</FormLabel>
              <FormControl>
                <Input placeholder="3/8, AP, unique…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
