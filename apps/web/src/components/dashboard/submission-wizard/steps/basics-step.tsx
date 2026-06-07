"use client";

import type { BasicsStepProps } from "@/components/dashboard/submission-wizard/step-props";
import { CategoryPicker } from "@/components/forms/category-picker";
import { SellPrerequisitesInline } from "@/components/marketing/sell-journey/sell-prerequisites-inline";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";

const labelClass =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

export function BasicsStep({ form, categories }: BasicsStepProps) {
  return (
    <div className="space-y-6" data-testid="submission-wizard-step-basics">
      <SellPrerequisitesInline />
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={labelClass}>
              <LabelCaps>Title</LabelCaps>
            </FormLabel>
            <FormControl>
              <UnderlineInput placeholder="Work title" {...field} />
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
            <FormLabel className={labelClass}>
              <LabelCaps>Categories</LabelCaps>
            </FormLabel>
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
              <FormLabel className={labelClass}>
                <LabelCaps>Year of work</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput
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
              <FormLabel className={labelClass}>
                <LabelCaps>Edition (optional)</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput placeholder="3/8, AP, unique…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
