"use client";

import { UnderlineInput } from "@/components/ui/input";
import { changePasswordAction } from "@/lib/actions/change-password";
import { notify } from "@/lib/ui/notify";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { type PasswordChangeFormValues, passwordChangeFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldPath, useForm } from "react-hook-form";

const defaultValues: PasswordChangeFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function SecurityPasswordForm() {
  const form = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeFormSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          form.clearErrors("root");
          const r = await changePasswordAction(values);
          if (r.ok) {
            form.reset();
            notify.success("Password updated", {
              description: "You can use your new password next time you sign in.",
            });
            return;
          }
          if (r.fieldErrors) {
            for (const [key, msgs] of Object.entries(r.fieldErrors)) {
              if (msgs?.[0]) {
                form.setError(key as FieldPath<PasswordChangeFormValues>, { message: msgs[0] });
              }
            }
          } else {
            form.setError("root", { message: r.error });
            notify.error(r.error);
          }
        })}
      >
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
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
              <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
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
              <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
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
        <LoadingButton
          type="submit"
          variant="default"
          className="w-full"
          loading={form.formState.isSubmitting}
          loadingLabel="Saving…"
        >
          Update password
        </LoadingButton>
      </form>
    </Form>
  );
}
