"use client";

import { Button } from "@/components/ui/button";
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

export type PortfolioFilterValue = "all" | "due" | "paid" | "authorized" | "refunded";

type PortfolioFiltersProps = {
  initialQ: string;
  payment: PortfolioFilterValue;
  year: number | null;
  years: readonly number[];
};

const PAYMENT_OPTIONS: Array<{ id: PortfolioFilterValue; label: string }> = [
  { id: "all", label: "All" },
  { id: "due", label: "Awaiting payment" },
  { id: "authorized", label: "Authorized" },
  { id: "paid", label: "Paid" },
  { id: "refunded", label: "Refunded" },
];

/** Combined search + payment + year filters for the private collection page.
 *
 * Filters live in the URL so views are shareable and resilient to back/forward
 * navigation.
 */
export function PortfolioFilters({ initialQ, payment, year, years }: PortfolioFiltersProps) {
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

  const togglePayment = useCallback(
    (value: PortfolioFilterValue) => {
      updateParams((p) => {
        if (value === "all") p.delete("payment");
        else p.set("payment", value);
      });
    },
    [updateParams],
  );

  const setYear = useCallback(
    (next: number | null) => {
      updateParams((p) => {
        if (next == null) p.delete("year");
        else p.set("year", String(next));
      });
    },
    [updateParams],
  );

  return (
    <div className="mb-8 space-y-4 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm">
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
                  htmlFor="portfolio-q"
                  className="font-label text-xs uppercase tracking-widest text-secondary"
                >
                  Search collection
                </FormLabel>
                <FormControl>
                  <Input
                    id="portfolio-q"
                    placeholder="Filter by title\u2026"
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
        <legend className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Payment status
        </legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {PAYMENT_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.id}
              pressed={payment === opt.id}
              onClick={() => togglePayment(opt.id)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>
      </fieldset>

      {years.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Acquired in
          </legend>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip pressed={year == null} onClick={() => setYear(null)}>
              All years
            </FilterChip>
            {years.map((y) => (
              <FilterChip key={y} pressed={year === y} onClick={() => setYear(y)}>
                {y}
              </FilterChip>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
