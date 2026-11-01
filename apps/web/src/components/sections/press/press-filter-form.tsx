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
import { Button, Field, NativeSelect, TextInput } from "@auction/ui/lax";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

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
  const resultCountLabel = resultCount != null ? formatPressArticleCount(resultCount) : null;
  const yearOptions = [
    { value: "", label: "All years" },
    ...years.map((year) => ({ value: String(year), label: String(year) })),
  ];
  const typeOptions = [
    { value: PRESS_FILTER_ALL, label: "All types" },
    ...PRESS_MENTION_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
  ];

  return (
    <form
      id={formId}
      className={cn(
        isSheet
          ? "flex flex-col gap-5"
          : "flex flex-col gap-3 lg:grid lg:w-full lg:grid-cols-[minmax(14rem,1fr)_10rem_10rem_auto] lg:items-end lg:gap-3",
        className,
      )}
      onSubmit={form.handleSubmit((values) => {
        router.push(buildPressHubQuery(pressFilterFormValuesToHubParams(values)));
        onSubmitted?.();
      })}
      noValidate
    >
      <div className="flex min-w-0 flex-col gap-2">
        <Field label="Search" optional quiet id={inputId} error={form.formState.errors.q?.message}>
          <TextInput type="search" placeholder="Outlet, headline, sale…" {...form.register("q")} />
        </Field>
        {resultCountLabel ? (
          <p className="text-lax-12 font-medium text-lax-muted tabular-nums" aria-live="polite">
            {resultCountLabel}
          </p>
        ) : null}
      </div>
      <Field label="Year" optional quiet id={yearSelectId} className="min-w-0">
        <Controller
          control={form.control}
          name="year"
          render={({ field }) => (
            <NativeSelect
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={yearOptions}
            />
          )}
        />
      </Field>
      <Field label="Coverage type" optional quiet id={mentionTypeSelectId} className="min-w-0">
        <Controller
          control={form.control}
          name="mentionType"
          render={({ field }) => (
            <NativeSelect
              value={field.value || PRESS_FILTER_ALL}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={typeOptions}
            />
          )}
        />
      </Field>
      {!isSheet ? (
        <Button type="submit" variant="primary" className="w-full shrink-0 lg:w-auto">
          Apply
        </Button>
      ) : null}
    </form>
  );
}
