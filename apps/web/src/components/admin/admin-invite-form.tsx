"use client";

import { InviteEmailChipInput } from "@/components/admin/invite-email-chip-input";
import {
  type DraftPlatformGrant,
  InvitePlatformAccessPicker,
  platformGrantsError,
} from "@/components/admin/invite-platform-access-picker";
import { RhfSelect } from "@/components/ui/rhf-select";
import { adminCreateInvitationResultAction } from "@/lib/actions/admin";
import { MAX_INVITE_BATCH } from "@/lib/admin/parse-invite-email-list";
import { useActionForm } from "@/lib/forms/use-action-form";
import { notify } from "@/lib/ui/notify";
import type { UserRole } from "@auction/types";
import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { adminCreateInvitationBodySchema } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useWatch } from "react-hook-form";

const labelCls =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

type BatchFailure = { email: string; message: string };

type BatchResult = {
  sent: number;
  failures: BatchFailure[];
} | null;

type Props = {
  formId?: string;
  layout?: "dialog";
  onSubmittingChange?: (submitting: boolean) => void;
  onCompleteSuccess?: () => void;
};

const coarseRoleOptions: { value: UserRole; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "staff", label: "Staff" },
];

export function AdminInviteForm({ formId, layout, onSubmittingChange, onCompleteSuccess }: Props) {
  const router = useRouter();
  const recipientsId = useId();
  const recipientsHintId = useId();
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult>(null);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [platformGrants, setPlatformGrants] = useState<DraftPlatformGrant[]>([]);
  const [grantsError, setGrantsError] = useState<string | null>(null);
  const isDialog = layout === "dialog";

  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: adminCreateInvitationBodySchema,
    defaultValues: {
      email: "",
      targetRole: "client",
      grants: undefined,
    },
    action: adminCreateInvitationResultAction,
    ...(isDialog ? {} : { successToast: { title: "Invitation sent" } }),
    onSuccess: () => {
      setRecipientEmails([]);
      setBatchResult(null);
      setRecipientError(null);
      setPlatformGrants([]);
      form.reset({ email: "", targetRole: "client", grants: undefined });
      router.refresh();
      if (isDialog) {
        notify.success("Invitation sent");
      }
      onCompleteSuccess?.();
    },
  });

  const targetRole = useWatch({ control: form.control, name: "targetRole" });

  useEffect(() => {
    form.setValue(
      "grants",
      targetRole === "staff" && platformGrants.length > 0 ? platformGrants : undefined,
    );
    setGrantsError(null);
  }, [targetRole, platformGrants, form]);

  const submitting = isSubmitting || isBatchSubmitting;

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBatchResult(null);
    setRecipientError(null);
    form.clearErrors();

    const values = form.getValues();

    if (recipientEmails.length === 0) {
      setRecipientError("Enter at least one email address");
      return;
    }
    if (recipientEmails.length > MAX_INVITE_BATCH) {
      setRecipientError(`Maximum ${MAX_INVITE_BATCH} recipients per batch`);
      return;
    }
    if (values.targetRole === "staff") {
      const message = platformGrantsError(platformGrants);
      if (message) {
        setGrantsError(message);
        return;
      }
    }

    if (recipientEmails.length === 1) {
      form.setValue("email", recipientEmails[0] ?? "");
      await onSubmit(e);
      return;
    }

    setIsBatchSubmitting(true);
    let sent = 0;
    const failures: BatchFailure[] = [];

    for (const email of recipientEmails) {
      const result = await adminCreateInvitationResultAction({
        email,
        targetRole: values.targetRole,
        ...(values.grants ? { grants: values.grants } : {}),
      });
      if (result.ok) {
        sent += 1;
      } else {
        failures.push({ email, message: result.error });
      }
    }

    setIsBatchSubmitting(false);
    setBatchResult({ sent, failures });

    if (sent > 0) {
      setRecipientEmails([]);
      form.reset({ email: "", targetRole: values.targetRole, grants: values.grants });
      router.refresh();
    }

    if (failures.length === 0) {
      notify.success(`${sent} invitation${sent === 1 ? "" : "s"} sent`);
      onCompleteSuccess?.();
    }
  }

  return (
    <div className="space-y-5">
      {rootError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not send invitation</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      ) : null}
      {batchResult ? (
        <Alert variant={batchResult.failures.length > 0 ? "warning" : "success"}>
          <AlertTitle>
            {batchResult.failures.length > 0
              ? `${batchResult.sent} sent, ${batchResult.failures.length} failed`
              : `${batchResult.sent} invitation${batchResult.sent === 1 ? "" : "s"} sent`}
          </AlertTitle>
          {batchResult.failures.length > 0 ? (
            <AlertDescription>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {batchResult.failures.map((f) => (
                  <li key={f.email}>
                    <span className="font-medium">{f.email}</span>: {f.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      <Form {...form}>
        <form id={formId} onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={() => (
              <FormItem className="grid gap-1.5">
                <FormLabel htmlFor={recipientsId} className={labelCls} id={`${recipientsId}-label`}>
                  Recipients
                </FormLabel>
                <InviteEmailChipInput
                  id={recipientsId}
                  emails={recipientEmails}
                  onChange={(next) => {
                    setRecipientEmails(next);
                    setRecipientError(null);
                  }}
                  disabled={submitting}
                  aria-describedby={recipientsHintId}
                  aria-invalid={recipientError != null}
                />
                <FormDescription id={recipientsHintId}>
                  Paste from a spreadsheet column or separate addresses with commas. Up to{" "}
                  {MAX_INVITE_BATCH} per batch.
                </FormDescription>
                {recipientError ? (
                  <p className="font-body text-sm text-error" role="alert">
                    {recipientError}
                  </p>
                ) : null}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="targetRole"
            render={({ field }) => (
              <FormItem className="grid gap-2.5">
                <FormLabel className={labelCls}>Role</FormLabel>
                {isDialog ? (
                  <fieldset
                    disabled={submitting}
                    className="m-0 flex flex-wrap gap-2.5 border-0 p-0"
                    aria-label="Invitation role"
                  >
                    {coarseRoleOptions.map((option) => {
                      const selected = field.value === option.value;
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant="outline"
                          disabled={submitting}
                          aria-pressed={selected}
                          className={cn(
                            "h-11 min-w-[9.375rem] rounded-lg border-2 font-body text-base font-medium",
                            selected
                              ? "border-on-surface bg-surface-container-low text-on-surface"
                              : "border-border-soft bg-shell-search-bg text-on-surface-variant",
                          )}
                          onClick={() => field.onChange(option.value)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </fieldset>
                ) : (
                  <RhfSelect
                    value={field.value ?? "client"}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    options={coarseRoleOptions}
                    triggerClassName="min-h-11 w-full font-body text-sm"
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {targetRole === "staff" ? (
            <fieldset className="m-0 grid gap-2.5 border-0 p-0" disabled={submitting}>
              <legend className={labelCls}>Platform access</legend>
              <p className="font-body text-sm text-on-surface-variant">
                One LAX account works on every platform. Choose where they get staff access and the
                role on each. People who already have an account can accept after signing in.
              </p>
              <InvitePlatformAccessPicker
                value={platformGrants}
                onChange={setPlatformGrants}
                disabled={submitting}
              />
              {grantsError ? (
                <p className="font-body text-sm text-error" role="alert">
                  {grantsError}
                </p>
              ) : null}
            </fieldset>
          ) : (
            <p className="font-body text-sm text-on-surface-variant">
              Clients create a LAX account with the link we send. Existing accounts don&apos;t need
              an invitation.
            </p>
          )}

          {!isDialog ? (
            <Button
              type="submit"
              className="min-h-11 w-full font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] sm:w-auto"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Send invite"}
            </Button>
          ) : null}
        </form>
      </Form>
    </div>
  );
}
