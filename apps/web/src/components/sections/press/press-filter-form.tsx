"use client";

import { type PressHubParams, buildPressHubQuery } from "@/lib/marketing/press-params";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const pressFilterSchema = z.object({
  q: z.string().trim().max(200),
  year: z.string(),
});

type PressFilterValues = z.infer<typeof pressFilterSchema>;

type Props = {
  initialParams: PressHubParams;
  years: number[];
  /** `sheet` hides inline submit — use sheet Apply instead. */
  variant?: "default" | "sheet";
  onSubmitted?: () => void;
  formId?: string;
  inputId?: string;
  yearSelectId?: string;
  className?: string;
};

export function PressFilterForm({
  initialParams,
  years,
  variant = "default",
  onSubmitted,
  formId,
  inputId = "press-q",
  yearSelectId = "press-year",
  className,
}: Props) {
  const router = useRouter();
  const form = useForm<PressFilterValues>({
    resolver: zodResolver(pressFilterSchema),
    defaultValues: {
      q: initialParams.q,
      year: initialParams.year != null ? String(initialParams.year) : "",
    },
  });

  useEffect(() => {
    form.reset({
      q: initialParams.q,
      year: initialParams.year != null ? String(initialParams.year) : "",
    });
  }, [initialParams.q, initialParams.year, form]);

  const isSheet = variant === "sheet";
  const labelClassName =
    "mb-2 block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";
  const inputClassName =
    "rounded-none border-0 border-b-2 border-input-border bg-transparent px-0 shadow-none focus-visible:border-input-border-focus focus-visible:ring-1 focus-visible:ring-input-border-focus";
  const selectClassName = cn(
    "h-11 min-h-11 w-full rounded-md border border-outline-variant/50 bg-surface px-3 font-body text-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  );

  return (
    <Form {...form}>
      <form
        id={formId}
        className={cn(
          isSheet ? "flex flex-col gap-6" : "flex flex-col gap-3 lg:flex-row lg:items-end",
          className,
        )}
        onSubmit={form.handleSubmit((values) => {
          const yearParsed = values.year ? Number.parseInt(values.year, 10) : Number.NaN;
          const year =
            Number.isFinite(yearParsed) && yearParsed >= 2000 && yearParsed <= 2100
              ? yearParsed
              : null;
          router.push(
            buildPressHubQuery({
              q: values.q.trim(),
              year,
              page: 1,
            }),
          );
          onSubmitted?.();
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="min-w-0 flex-1 lg:min-w-[14rem]">
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
        <FormField
          control={form.control}
          name="year"
          render={({ field }) => (
            <FormItem className="w-full shrink-0 lg:w-auto lg:min-w-[8rem]">
              <label htmlFor={yearSelectId} className={labelClassName}>
                Year
              </label>
              <FormControl>
                <select id={yearSelectId} className={selectClassName} {...field}>
                  <option value="">All years</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </FormControl>
            </FormItem>
          )}
        />
        {!isSheet ? (
          <Button type="submit" variant="cta" className="h-11 min-h-[44px] shrink-0 px-8">
            Apply
          </Button>
        ) : null}
      </form>
    </Form>
  );
}
