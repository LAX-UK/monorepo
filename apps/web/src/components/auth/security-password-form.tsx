"use client";

import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

export function SecurityPasswordForm() {
  const form = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          form.clearErrors("root");
          const res = await fetch(`${apiBase()}/api/auth/change-password`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
              revokeOtherSessions: false,
            }),
          });
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          if (!res.ok) {
            form.setError("root", {
              message:
                typeof body.message === "string" ? body.message : "Could not change password",
            });
            return;
          }
          form.reset();
          toast.success("Password updated", {
            description: "You can use your new password next time you sign in.",
          });
        })}
      >
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                Current password
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  type="password"
                  autoComplete="current-password"
                  className="w-full border-b-2 border-outline-variant/40 py-3"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                New password
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  type="password"
                  autoComplete="new-password"
                  className="w-full border-b-2 border-outline-variant/40 py-3"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                Confirm new password
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  type="password"
                  autoComplete="new-password"
                  className="w-full border-b-2 border-outline-variant/40 py-3"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root ? (
          <p className="text-sm text-error" role="alert">
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Saving…" : "Update password"}
        </Button>
      </form>
    </Form>
  );
}
