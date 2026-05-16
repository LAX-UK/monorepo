"use client";

import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
  variant = "default",
  onSubmitted,
  formId,
}: {
  initialQ: string;
  sort: string;
  categoryId?: string | undefined;
  /** Preserved across submit (catalogue layout). */
  view?: string | undefined;
  /** `hero` / `sheet` drop outer margin; `sheet` hides the inline submit (use sheet Apply). */
  variant?: "default" | "hero" | "sheet";
  onSubmitted?: () => void;
  formId?: string;
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
          const qTrim = values.q.trim();
          if (qTrim) params.set("q", qTrim);
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
                htmlFor="search-q"
                className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
              >
                Keywords
              </label>
              <FormControl>
                <Input
                  id="search-q"
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
