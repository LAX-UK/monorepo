"use client";

import { CategoryPicker } from "@/components/forms/category-picker";
import type { SubmissionDecisionQueue } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { CategoryNode } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const adminSubmissionsTitleFilterSchema = z.object({
  q: z.string().trim().max(200),
});

type AdminSubmissionsTitleFilterValues = z.infer<typeof adminSubmissionsTitleFilterSchema>;

export function AdminSubmissionsTitleFilterForm({
  initialQ,
  initialCategoryId,
  categories,
  queue,
}: {
  initialQ: string;
  initialCategoryId?: string | null;
  categories: CategoryNode[];
  queue: SubmissionDecisionQueue;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categoryIds, setCategoryIds] = useState(initialCategoryId ? [initialCategoryId] : []);

  useEffect(() => {
    setCategoryIds(initialCategoryId ? [initialCategoryId] : []);
  }, [initialCategoryId]);

  const form = useForm<AdminSubmissionsTitleFilterValues>({
    resolver: zodResolver(adminSubmissionsTitleFilterSchema),
    defaultValues: { q: initialQ },
  });

  return (
    <Form {...form}>
      <form
        className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={form.handleSubmit((values) => {
          const sp: Record<string, string | string[] | undefined> = {};
          searchParams.forEach((v, k) => {
            sp[k] = v;
          });
          const href = buildListHref("/admin/submissions", sp, {
            queue,
            q: values.q.trim() || "",
            categoryId: categoryIds[0] ?? "",
            offset: 0,
          });
          router.push(href);
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="grid min-w-0 flex-1 gap-1 sm:max-w-md">
              <label
                htmlFor="admin-submissions-q"
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
              >
                Title contains (server)
              </label>
              <FormControl>
                <Input
                  id="admin-submissions-q"
                  placeholder="Apply to narrow API result..."
                  className="min-h-11 bg-surface-container-low text-base md:text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid min-w-0 flex-1 gap-1 sm:max-w-md">
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Category
          </span>
          <CategoryPicker
            categories={categories}
            value={categoryIds}
            onChange={setCategoryIds}
            multiple={false}
            placeholder="Any category"
          />
        </div>
        <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
          Apply filters
        </Button>
      </form>
    </Form>
  );
}
