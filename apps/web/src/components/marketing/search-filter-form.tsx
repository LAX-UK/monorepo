"use client";

import { trackSearch } from "@/lib/analytics/events";
import { errorCopy } from "@/lib/forms/error-copy";
import { publicFormResolver } from "@/lib/forms/public-form-resolver";
import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import type { LotStatus } from "@auction/types";
import { cn } from "@auction/ui";
import { Button, Field, TextInput } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const searchFilterSchema = z.object({
  q: z.string().trim().max(200, errorCopy.maxLength(200, "your search")),
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
    resolver: publicFormResolver(searchFilterSchema),
    defaultValues: { q: initialQ },
  });

  const isSheet = variant === "sheet";
  const showSubmit = !isSheet;

  return (
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
      <Field
        label="Keywords"
        optional
        quiet
        id={inputId}
        error={form.formState.errors.q?.message}
        className="min-w-0 flex-1"
      >
        <TextInput
          type="search"
          enterKeyHint="search"
          placeholder="Search by lot title…"
          {...form.register("q")}
        />
      </Field>
      {showSubmit ? (
        <Button type="submit" variant="primary" className="shrink-0">
          Search
        </Button>
      ) : null}
    </form>
  );
}

/** Desktop-only inline keyword search on `/search` (mobile/tablet use the filter sheet). */
export function SearchFilterFormDesktop(
  props: Omit<ComponentProps<typeof SearchFilterForm>, "variant">,
) {
  return (
    <div className={cn("mb-6 hidden lg:block")}>
      <SearchFilterForm {...props} variant="hero" inputId="search-q" />
    </div>
  );
}
