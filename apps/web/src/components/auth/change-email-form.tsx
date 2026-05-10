"use client";

import { UnderlineInput } from "@/components/ui/input";
import {
  cancelEmailChangeAction,
  requestEmailChangeAction,
} from "@/lib/actions/request-email-change";
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
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";

export function ChangeEmailForm({
  currentEmail,
  hasPendingEmailChange,
}: {
  currentEmail: string;
  hasPendingEmailChange?: boolean;
}) {
  const router = useRouter();
  const [cancelPending, startCancel] = useTransition();
  const form = useForm<RequestEmailChangeInput>({
    resolver: zodResolver(requestEmailChangeSchema),
    defaultValues: { newEmail: "", confirmEmail: "" },
  });

  return (
    <>
      <Form {...form}>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (values) => {
            form.clearErrors("root");
            const result = await requestEmailChangeAction(values);
            if (result.ok) {
              notify.success("Confirmation links sent", {
                description: `Confirm from ${maskEmail(currentEmail)} and from your new inbox — both are required.`,
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
      {hasPendingEmailChange ? (
        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-on-surface-variant"
            disabled={cancelPending}
            onClick={() => {
              startCancel(async () => {
                const r = await cancelEmailChangeAction();
                if (!r.ok) {
                  notify.error(r.error);
                  return;
                }
                notify.success("Email change cancelled");
                router.refresh();
              });
            }}
          >
            {cancelPending ? "Cancelling…" : "Cancel in-progress email change"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
