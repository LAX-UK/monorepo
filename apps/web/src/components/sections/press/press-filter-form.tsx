"use client";

import {
  PRESS_FILTER_ALL,
  PRESS_MENTION_TYPE_OPTIONS,
  type PressHubParams,
  buildPressHubQuery,
  formatPressArticleCount,
  pressFilterFormValuesToHubParams,
  pressHubParamsToFilterFormValues,
} from "@/lib/marketing/press-params";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const ALL_YEARS = PRESS_FILTER_ALL;
const ALL_MENTION_TYPES = PRESS_FILTER_ALL;

const pressFilterSchema = z.object({
  q: z.string().trim().max(200),
  year: z.string(),
  mentionType: z.string(),
});

type PressFilterValues = z.infer<typeof pressFilterSchema>;

type Props = {
  initialParams: PressHubParams;
  years: number[];
  resultCount?: number;
  /** `sheet` hides inline submit — use sheet Apply instead. */
  variant?: "default" | "sheet";
  onSubmitted?: () => void;
  formId?: string;
  inputId?: string;
  yearSelectId?: string;
  mentionTypeSelectId?: string;
  className?: string;
};

export function PressFilterForm({
  initialParams,
  years,
  resultCount,
  variant = "default",
  onSubmitted,
  formId,
  inputId = "press-q",
  yearSelectId = "press-year",
  mentionTypeSelectId = "press-mention-type",
  className,
}: Props) {
  const router = useRouter();
  const form = useForm<PressFilterValues>({
    resolver: zodResolver(pressFilterSchema),
    defaultValues: pressHubParamsToFilterFormValues(initialParams),
  });

  useEffect(() => {
    form.reset(pressHubParamsToFilterFormValues(initialParams));
  }, [initialParams, form]);

  const isSheet = variant === "sheet";
  const labelClassName =
    "block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";
  const inputClassName = cn(
    "h-11 min-h-11 rounded-none border-0 border-b-2 border-input-border bg-transparent px-0 shadow-none focus-visible:border-input-border-focus focus-visible:ring-1 focus-visible:ring-input-border-focus",
  );
  const selectClassName = cn(
    "h-11 min-h-11 w-full rounded-md border border-outline-variant/50 bg-surface font-body text-sm text-on-surface lg:w-[10rem]",
  );
  const fieldClassName = "space-y-2";
  const resultCountLabel = resultCount != null ? formatPressArticleCount(resultCount) : null;

  return (
    <Form {...form}>
      <form
        id={formId}
        className={cn(
          isSheet
            ? "flex flex-col gap-6"
            : "flex flex-col gap-3 lg:grid lg:w-full lg:grid-cols-[minmax(14rem,1fr)_10rem_10rem_auto] lg:items-start lg:gap-3",
          className,
        )}
        onSubmit={form.handleSubmit((values) => {
          router.push(buildPressHubQuery(pressFilterFormValuesToHubParams(values)));
          onSubmitted?.();
        })}
        noValidate
      >
        <div className="min-w-0 space-y-2">
          <FormField
            control={form.control}
            name="q"
            render={({ field }) => (
              <FormItem className="min-w-0 space-y-2">
                <label htmlFor={inputId} className={labelClassName}>
                  Search
                </label>
                <FormControl>
                  <Input
                    id={inputId}
                    type="search"
                    placeholder="Outlet, headline, sale…"
                    className={inputClassName}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {resultCountLabel ? (
            <p
              className="font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant tabular-nums"
              aria-live="polite"
            >
              {resultCountLabel}
            </p>
          ) : null}
        </div>
        <FormField
          control={form.control}
          name="year"
          render={({ field }) => (
            <FormItem className="min-w-0 space-y-2">
              <label htmlFor={yearSelectId} className={labelClassName}>
                Year
              </label>
              <Select
                value={field.value || ALL_YEARS}
                onValueChange={(value) => field.onChange(value === ALL_YEARS ? "" : value)}
              >
                <FormControl>
                  <SelectTrigger id={yearSelectId} className={selectClassName} aria-label="Year">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={ALL_YEARS}>All years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mentionType"
          render={({ field }) => (
            <FormItem className="min-w-0 space-y-2">
              <label htmlFor={mentionTypeSelectId} className={labelClassName}>
                Coverage type
              </label>
              <Select value={field.value || ALL_MENTION_TYPES} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger
                    id={mentionTypeSelectId}
                    className={selectClassName}
                    aria-label="Coverage type"
                  >
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={ALL_MENTION_TYPES}>All types</SelectItem>
                  {PRESS_MENTION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        {!isSheet ? (
          <div className={cn(fieldClassName, "w-full shrink-0 lg:w-auto")}>
            <span className={cn(labelClassName, "invisible select-none")} aria-hidden>
              Apply
            </span>
            <Button
              type="submit"
              variant="cta"
              className="h-11 min-h-11 w-full shrink-0 px-8 lg:w-auto"
            >
              Apply
            </Button>
          </div>
        ) : null}
      </form>
    </Form>
  );
}
