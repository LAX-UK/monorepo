"use client";

import { StepUpDialog } from "@/components/auth/step-up/step-up-dialog";
import { UnderlineInput } from "@/components/ui/input";
import {
  cancelEmailChangeAction,
  requestEmailChangeAction,
} from "@/lib/actions/request-email-change";
import { AUTH_ERROR_MESSAGES, isAuthErrorCode } from "@/lib/auth/auth-error-code";
import { actionResultToStepUpVoid, useStepUpCoordinator, withStepUp } from "@/lib/auth/step-up";
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
  const coordinator = useStepUpCoordinator();
  const form = useForm<RequestEmailChangeInput>({
    resolver: zodResolver(requestEmailChangeSchema),
    defaultValues: { newEmail: "", confirmEmail: "" },
  });

  return (
    <>
      <StepUpDialog coordinator={coordinator} />
      <Form {...form}>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (values) => {
            form.clearErrors("root");
            const raw = await requestEmailChangeAction(values);
            if (raw.ok) {
              notify.success("Confirmation links sent", {
                description: `Confirm from ${maskEmail(currentEmail)} and from your new inbox — both are required.`,
              });
              form.reset();
              return;
            }
            if (raw.fieldErrors) {
              for (const [key, messages] of Object.entries(raw.fieldErrors)) {
                if (messages?.[0]) {
                  form.setError(key as FieldPath<RequestEmailChangeInput>, {
                    message: messages[0],
                  });
                }
              }
              return;
            }
            if (
              raw.errorCode === "recent_auth_required" ||
              raw.errorCode === "credential_required"
            ) {
              const after = await withStepUp(
                async () => actionResultToStepUpVoid(await requestEmailChangeAction(values)),
                coordinator,
              );
              if (!after.ok) {
                if (
                  after.reason === "recent_auth_required" ||
                  after.reason === "credential_required"
                ) {
                  return;
                }
                form.setError("root", {
                  message: "Could not send confirmation. Please try again.",
                });
                notify.error("Could not send confirmation. Please try again.");
                return;
              }
              notify.success("Confirmation links sent", {
                description: `Confirm from ${maskEmail(currentEmail)} and from your new inbox — both are required.`,
              });
              form.reset();
              return;
            }
            const displayError =
              raw.errorCode && isAuthErrorCode(raw.errorCode)
                ? AUTH_ERROR_MESSAGES[raw.errorCode]
                : raw.error;
            form.setError("root", { message: displayError });
            notify.error(displayError);
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
                const r = await withStepUp(
                  async () => actionResultToStepUpVoid(await cancelEmailChangeAction()),
                  coordinator,
                );
                if (!r.ok) {
                  if (r.reason === "recent_auth_required" || r.reason === "credential_required") {
                    return;
                  }
                  notify.error("Could not cancel email change. Please try again.");
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
