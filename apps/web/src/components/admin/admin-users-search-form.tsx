"use client";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@auction/types";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const adminUsersSearchSchema = z.object({
  q: z.string().trim().max(200),
});

type AdminUsersSearchValues = z.infer<typeof adminUsersSearchSchema>;

export function AdminUsersSearchForm({
  initialQ,
  roleFilter,
  suspendedOnly,
}: {
  initialQ: string;
  roleFilter?: UserRole | undefined;
  suspendedOnly: boolean;
}) {
  const router = useRouter();
  const form = useForm<AdminUsersSearchValues>({
    resolver: zodResolver(adminUsersSearchSchema),
    defaultValues: { q: initialQ },
  });

  return (
    <Form {...form}>
      <form
        className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={form.handleSubmit((values) => {
          const params = new URLSearchParams();
          const q = values.q.trim();
          if (q) params.set("q", q);
          if (roleFilter) params.set("role", roleFilter);
          if (suspendedOnly) params.set("suspended", "1");
          const query = params.toString();
          router.push(query ? `/admin/users?${query}` : "/admin/users");
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="grid min-w-0 flex-1 gap-1">
              <label
                htmlFor="admin-users-server-q"
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
              >
                Server search
              </label>
              <FormControl>
                <Input
                  id="admin-users-server-q"
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
