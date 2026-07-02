"use client";

import { UnderlineInput } from "@/components/ui/input";
import type { ConnectedAccountsActions } from "@/lib/auth/hooks/use-connected-accounts";
import { type ResetPasswordFormValues, resetPasswordFormSchema } from "@/lib/auth/schemas";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

const defaultValues: ResetPasswordFormValues = {
  newPassword: "",
  confirmPassword: "",
};

type SetPasswordFormProps = {
  setupPassword: ConnectedAccountsActions["setupPassword"];
};

export function SetPasswordForm({ setupPassword }: SetPasswordFormProps) {
  const router = useRouter();
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          form.clearErrors("root");
          const result = await setupPassword(values.newPassword);
          if (result.ok) {
            form.reset();
            notify.success("Password set", {
              description:
                "You can now sign in with email and password as well as linked accounts.",
            });
            router.replace("/dashboard/settings/security?password=set");
            router.refresh();
            return;
          }
          form.setError("root", { message: result.error });
          notify.error(result.error);
        })}
      >
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
                Confirm password
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
          Set password
        </LoadingButton>
      </form>
    </Form>
  );
}
