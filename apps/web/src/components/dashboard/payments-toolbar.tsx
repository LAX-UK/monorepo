"use client";

import { Button } from "@/components/ui/button";
import type { PaymentsSort } from "@/lib/data/view-models/dashboard-payments.vm";
import { urlTitleSearchSchema } from "@/lib/forms/schemas/url-search";
import { FilterChip } from "@auction/ui";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";

type QForm = { q: string };

type Props = {
  initialQ: string;
  sort: PaymentsSort;
  year: number | null;
  years: readonly number[];
  /** When true, omit outer chrome (parent `DashboardToolbar` provides it). */
  embedded?: boolean;
};

const SORT_OPTIONS: Array<{ id: PaymentsSort; label: string }> = [
  { id: "date-desc", label: "Newest" },
  { id: "date-asc", label: "Oldest" },
  { id: "amount-desc", label: "Highest first" },
  { id: "amount-asc", label: "Lowest first" },
];

/** Search + sort + year filter row for the buyer payments page. */
export function PaymentsToolbar({ initialQ, sort, year, years, embedded = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const form = useForm<QForm>({
    resolver: zodResolver(urlTitleSearchSchema),
    defaultValues: { q: initialQ },
  });

  useEffect(() => {
    form.reset({ q: initialQ });
  }, [form, initialQ]);

  const updateParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const applySearch = useCallback(
    (values: QForm) => {
      updateParams((p) => {
        const trimmed = values.q.trim();
        if (trimmed) p.set("q", trimmed);
        else p.delete("q");
      });
    },
    [updateParams],
  );

  return (
    <div
      className={
        embedded
          ? "space-y-3"
          : "space-y-3 rounded-xl border border-border-hairline bg-surface-container-lowest p-4 shadow-sm"
      }
    >
      <Form {...form}>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={form.handleSubmit(applySearch)}
        >
          <FormField
            control={form.control}
            name="q"
            render={({ field }) => (
              <FormItem className="flex-1 space-y-2">
                <FormLabel
                  htmlFor="payments-q"
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
                >
                  Search payments
                </FormLabel>
                <FormControl>
                  <Input
                    id="payments-q"
                    placeholder="Filter by lot title\u2026"
                    className="max-w-md bg-surface-container-low"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>
      </Form>

      <fieldset className="space-y-2">
        <legend className="block font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Sort by
        </legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.id}
              pressed={sort === opt.id}
              onClick={() => updateParams((p) => p.set("sort", opt.id))}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>
      </fieldset>

      {years.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="block font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Year
          </legend>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              pressed={year == null}
              onClick={() => updateParams((p) => p.delete("year"))}
            >
              All years
            </FilterChip>
            {years.map((y) => (
              <FilterChip
                key={y}
                pressed={year === y}
                onClick={() => updateParams((p) => p.set("year", String(y)))}
              >
                {y}
              </FilterChip>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
