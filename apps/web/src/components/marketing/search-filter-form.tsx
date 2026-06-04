"use client";

import { trackSearch } from "@/lib/analytics/events";
import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import type { LotStatus } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const searchFilterSchema = z.object({
  q: z.string().trim().max(200),
});

type SearchFilterValues = z.infer<typeof searchFilterSchema>;

export function SearchFilterForm({
  initialQ,
  sort,
  categoryId,
  view,
  status,
  ending,
  variant = "default",
  onSubmitted,
  formId,
  inputId = "search-q",
}: {
  initialQ: string;
  sort: string;
  categoryId?: string | undefined;
  /** Preserved across submit (catalogue layout). */
  view?: string | undefined;
  status?: LotStatus;
  ending?: SearchEndingWindow;
  /** `hero` / `sheet` drop outer margin; `sheet` hides the inline submit (use sheet Apply). */
  variant?: "default" | "hero" | "sheet";
  onSubmitted?: () => void;
  formId?: string;
  inputId?: string;
}) {
  const router = useRouter();
  const form = useForm<SearchFilterValues>({
    resolver: zodResolver(searchFilterSchema),
    defaultValues: { q: initialQ },
  });

  const isSheet = variant === "sheet";
  const showSubmit = !isSheet;

  return (
    <Form {...form}>
      <form
        id={formId}
        className={
          variant === "default"
            ? "mb-6 flex flex-col gap-3 sm:flex-row sm:items-end"
            : "flex flex-col gap-3 sm:flex-row sm:items-end"
        }
        onSubmit={form.handleSubmit((values) => {
          const params = new URLSearchParams();
          params.set("offset", "0");
          if (sort !== "endingAsc") params.set("sort", sort);
          if (categoryId) params.set("categoryId", categoryId);
          if (status) params.set("status", status);
          if (ending) params.set("ending", ending);
          const qTrim = values.q.trim();
          if (qTrim) {
            trackSearch(qTrim);
            params.set("q", qTrim);
          }
          if (view && (view === "grid" || view === "card" || view === "list")) {
            params.set("view", view);
          }
          router.push(`/search?${params.toString()}`);
          onSubmitted?.();
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="min-w-0 flex-1">
              <label
                htmlFor={inputId}
                className="mb-2 block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
              >
                Keywords
              </label>
              <FormControl>
                <Input
                  id={inputId}
                  placeholder="Search by lot title..."
                  className="rounded-none border-0 border-b-2 border-input-border bg-transparent px-0 shadow-none focus-visible:border-input-border-focus focus-visible:ring-1 focus-visible:ring-input-border-focus"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showSubmit ? (
          <Button type="submit" variant="cta" className="h-11 min-h-[44px] shrink-0 px-8">
            Search
          </Button>
        ) : null}
      </form>
    </Form>
  );
}

/** Desktop-only inline keyword search on `/search` (mobile uses the filter sheet). */
export function SearchFilterFormDesktop(
  props: Omit<ComponentProps<typeof SearchFilterForm>, "variant">,
) {
  return (
    <div className={cn("mb-6 hidden md:block")}>
      <SearchFilterForm {...props} variant="hero" inputId="search-q" />
    </div>
  );
}

/** Compact inline keyword search shown on mobile only (desktop uses the hero form). */
export function SearchFilterFormMobile(
  props: Omit<ComponentProps<typeof SearchFilterForm>, "variant">,
) {
  return (
    <div className={cn("mb-4 md:hidden")}>
      <SearchFilterForm {...props} variant="hero" inputId="search-q-mobile" />
    </div>
  );
}
