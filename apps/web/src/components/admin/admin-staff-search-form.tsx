"use client";

import type { UserStaffRole } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  q: z.string().trim().max(200),
});

type Values = z.infer<typeof schema>;

export function AdminStaffSearchForm({
  initialQ,
  staffRoleFilter,
  suspendedOnly,
}: {
  initialQ: string;
  staffRoleFilter?: UserStaffRole | undefined;
  suspendedOnly: boolean;
}) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { q: initialQ },
  });

  return (
    <Form {...form}>
      <form
        className="flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={form.handleSubmit((values) => {
          const params = new URLSearchParams();
          const q = values.q.trim();
          if (q) params.set("q", q);
          if (staffRoleFilter) params.set("staffRole", staffRoleFilter);
          if (suspendedOnly) params.set("suspended", "1");
          const query = params.toString();
          router.push(query ? `/admin/staff?${query}` : "/admin/staff");
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="grid min-w-0 flex-1 gap-1">
              <label
                htmlFor="admin-staff-q"
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
              >
                Search staff
              </label>
              <FormControl>
                <Input
                  id="admin-staff-q"
                  placeholder="Name or email"
                  className="min-h-11 text-base md:text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="min-h-11 px-6 py-3">
          Search
        </Button>
      </form>
    </Form>
  );
}
