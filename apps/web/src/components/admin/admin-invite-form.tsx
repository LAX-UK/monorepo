"use client";

import { RhfSelect } from "@/components/ui/rhf-select";
import { adminCreateInvitationResultAction } from "@/lib/actions/admin";
import { useActionForm } from "@/lib/forms/use-action-form";
import { type UserRole, userRoles } from "@auction/types";
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

function roleLabel(r: UserRole): string {
  if (r === "administrator") return "Administrator";
  if (r === "accountant") return "Accountant";
  return "Client";
}

const roleOptions = userRoles.map((r) => ({ value: r, label: roleLabel(r) }));

export function AdminInviteForm() {
  const router = useRouter();
  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: adminCreateInvitationBodySchema,
    defaultValues: {
      email: "",
      targetRole: "client",
    },
    action: adminCreateInvitationResultAction,
    successToast: { title: "Invitation sent" },
    onSuccess: () => {
      form.reset({ email: "", targetRole: "client" });
      router.refresh();
    },
  });

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
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
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
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
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
          <Button
            type="submit"
            className="min-h-11 font-label text-xs uppercase tracking-widest"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
