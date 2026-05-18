"use client";

import { RhfSelect } from "@/components/ui/rhf-select";
import { adminCreateInvitationResultAction } from "@/lib/actions/admin";
import { useActionForm } from "@/lib/forms/use-action-form";
import { type UserRole, userRoles } from "@auction/types";
import { type UserStaffRole, userStaffRoles } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { adminCreateInvitationBodySchema } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWatch } from "react-hook-form";

function roleLabel(r: UserRole): string {
  if (r === "staff") return "Staff";
  return "Client";
}

const roleOptions = userRoles.map((r) => ({ value: r, label: roleLabel(r) }));

function staffRoleLabel(r: UserStaffRole): string {
  return r.replace(/_/g, " ");
}

const staffRoleOptions = userStaffRoles.map((r) => ({
  value: r,
  label: staffRoleLabel(r),
}));

export function AdminInviteForm() {
  const router = useRouter();
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: adminCreateInvitationBodySchema,
    defaultValues: {
      email: "",
      targetRole: "client",
      targetStaffRole: undefined,
    },
    action: adminCreateInvitationResultAction,
    successToast: { title: "Invitation sent" },
    onSuccess: () => {
      form.reset({ email: "", targetRole: "client", targetStaffRole: undefined });
      router.refresh();
    },
  });

  const targetRole = useWatch({ control: form.control, name: "targetRole" });

  useEffect(() => {
    if (targetRole !== "staff") {
      form.setValue("targetStaffRole", undefined);
    }
  }, [targetRole, form]);

  return (
    <div className="mt-4 space-y-4">
      {rootError ? (
        <p
          className="rounded-sm border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {rootError}
        </p>
      ) : null}
      <Form {...form}>
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="grid min-w-0 flex-1 gap-1">
                <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
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
            name="targetRole"
            render={({ field }) => (
              <FormItem className="grid min-w-0 gap-1 sm:w-56">
                <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  Role
                </FormLabel>
                <RhfSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  options={roleOptions}
                  triggerClassName="min-h-11 w-full font-body text-sm"
                />
                <FormMessage />
              </FormItem>
            )}
          />
          {targetRole === "staff" ? (
            <FormField
              control={form.control}
              name="targetStaffRole"
              render={({ field }) => (
                <FormItem className="grid min-w-0 gap-1 sm:w-64">
                  <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                    Staff role
                  </FormLabel>
                  <RhfSelect
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v === "" ? undefined : v)}
                    onBlur={field.onBlur}
                    options={staffRoleOptions}
                    placeholder="Select staff role"
                    triggerClassName="min-h-11 w-full font-body text-sm"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          <Button
            type="submit"
            className="min-h-11 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending…" : "Send"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
