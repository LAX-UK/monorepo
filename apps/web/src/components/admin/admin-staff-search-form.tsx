"use client";

import { Button } from "@/components/ui/button";
import { staffRoleFilterOptions } from "@/lib/admin/staff-role-presenter";
import type { UserStaffRole } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  q: z.string().trim().max(200),
  staffRole: z.string().optional(),
});

type Values = z.infer<typeof schema>;

function isStaffRole(s: string | undefined): s is UserStaffRole {
  return s != null && (userStaffRoles as readonly string[]).includes(s);
}

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
    defaultValues: { q: initialQ, staffRole: staffRoleFilter ?? "" },
  });

  return (
    <Form {...form}>
      <form
        className="flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={form.handleSubmit((values) => {
          const params = new URLSearchParams();
          const q = values.q.trim();
          if (q) params.set("q", q);
          const role =
            values.staffRole && values.staffRole !== "__all__" ? values.staffRole : undefined;
          if (isStaffRole(role)) params.set("staffRole", role);
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
            <FormItem className="grid min-w-0 flex-1 gap-1 sm:min-w-[12rem]">
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
        <FormField
          control={form.control}
          name="staffRole"
          render={({ field }) => (
            <FormItem className="grid min-w-0 gap-1 sm:w-52">
              <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Staff role
              </FormLabel>
              <Select value={field.value || "__all__"} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__all__">All roles</SelectItem>
                  {staffRoleFilterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
