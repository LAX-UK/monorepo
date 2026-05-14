"use client";

import { buildListHref } from "@/lib/admin/admin-list-params";
import type { ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const adminSubmissionsTitleFilterSchema = z.object({
  q: z.string().trim().max(200),
});

type AdminSubmissionsTitleFilterValues = z.infer<typeof adminSubmissionsTitleFilterSchema>;

export function AdminSubmissionsTitleFilterForm({
  initialQ,
  status,
}: {
  initialQ: string;
  status?: ItemSubmissionStatus | undefined;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
            ...(status !== undefined ? { status } : { status: "" }),
            q: values.q.trim() || "",
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
                className="font-label text-xs uppercase tracking-widest text-secondary"
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
        <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
          Apply title filter
        </Button>
      </form>
    </Form>
  );
}
