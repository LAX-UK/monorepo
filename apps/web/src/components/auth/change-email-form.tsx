"use client";

import { UnderlineInput } from "@/components/ui/input";
import { requestEmailChangeAction } from "@/lib/actions/request-email-change";
import { maskEmail } from "@/lib/format/mask-email";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { type RequestEmailChangeInput, requestEmailChangeSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldPath, useForm } from "react-hook-form";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const form = useForm<RequestEmailChangeInput>({
    resolver: zodResolver(requestEmailChangeSchema),
    defaultValues: { newEmail: "", confirmEmail: "" },
  });

  return (
    <Form {...form}>
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit(async (values) => {
          form.clearErrors("root");
          const result = await requestEmailChangeAction(values);
          if (result.ok) {
            notify.success("Confirmation email sent", {
              description: `Check ${maskEmail(currentEmail)} to approve this change.`,
            });
            form.reset();
            return;
          }
          if (result.fieldErrors) {
            for (const [key, messages] of Object.entries(result.fieldErrors)) {
              if (messages?.[0]) {
                form.setError(key as FieldPath<RequestEmailChangeInput>, {
                  message: messages[0],
                });
              }
            }
            return;
          }
          form.setError("root", { message: result.error });
          notify.error(result.error);
        })}
      >
        <FormField
          control={form.control}
          name="newEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                New email
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  type="email"
                  autoComplete="email"
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
          name="confirmEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                Confirm email
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  type="email"
                  autoComplete="email"
                  className="w-full border-b-2 border-outline-variant/40 py-3"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root ? (
          <p className="font-body text-sm text-error" role="alert">
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <Button
          type="submit"
          className="min-h-11 w-full sm:w-auto"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Sending…" : "Send confirmation"}
        </Button>
      </form>
    </Form>
  );
}
