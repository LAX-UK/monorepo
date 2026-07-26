"use client";

import { InviteEmailChipInput } from "@/components/admin/invite-email-chip-input";
import { PlatformRoleBadge } from "@/components/admin/platform-role-badge";
import { RhfSelect } from "@/components/ui/rhf-select";
import { adminCreateInvitationResultAction } from "@/lib/actions/admin";
import { MAX_INVITE_BATCH } from "@/lib/admin/parse-invite-email-list";
import { useActionForm } from "@/lib/forms/use-action-form";
import { staffRoleFilterOptions } from "@/lib/presenters/platform-role/platform-role-registry";
import { notify } from "@/lib/ui/notify";
import type { UserRole } from "@auction/types";
import type { UserStaffRole } from "@auction/types";
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

const staffRoleOptions = staffRoleFilterOptions.map((o) => ({
  value: o.value,
  label: o.label,
}));

export function AdminInviteForm({ formId, layout, onSubmittingChange, onCompleteSuccess }: Props) {
  const router = useRouter();
  const recipientsId = useId();
  const recipientsHintId = useId();
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult>(null);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const isDialog = layout === "dialog";

  const { form, onSubmit, isSubmitting, rootError } = useActionForm({
    schema: adminCreateInvitationBodySchema,
    defaultValues: {
      email: "",
      targetRole: "client",
      targetStaffRole: undefined,
    },
    action: adminCreateInvitationResultAction,
    ...(isDialog ? {} : { successToast: { title: "Invitation sent" } }),
    onSuccess: () => {
      setRecipientEmails([]);
      setBatchResult(null);
      setRecipientError(null);
      form.reset({ email: "", targetRole: "client", targetStaffRole: undefined });
      router.refresh();
      if (isDialog) {
        notify.success("Invitation sent");
      }
      onCompleteSuccess?.();
    },
  });

  const targetRole = useWatch({ control: form.control, name: "targetRole" });
  const targetStaffRole = useWatch({ control: form.control, name: "targetStaffRole" });

  useEffect(() => {
    if (targetRole !== "staff") {
      form.setValue("targetStaffRole", undefined);
    }
  }, [targetRole, form]);

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
    if (values.targetRole === "staff" && values.targetStaffRole == null) {
      form.setError("targetStaffRole", { message: "Select a staff role" });
      return;
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
        ...(values.targetStaffRole != null ? { targetStaffRole: values.targetStaffRole } : {}),
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
      form.reset({
        email: "",
        targetRole: values.targetRole,
        targetStaffRole: values.targetStaffRole,
      });
      router.refresh();
    }

    if (failures.length === 0) {
      notify.success(`${sent} invitation${sent === 1 ? "" : "s"} sent`);
      onCompleteSuccess?.();
    }
  }

  const accessPreviewRole =
    targetRole === "staff" && targetStaffRole ? ("staff" as const) : targetRole;
  const accessPreviewStaffRole = targetRole === "staff" ? (targetStaffRole ?? null) : null;

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
                    value={field.value}
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
            <FormField
              control={form.control}
              name="targetStaffRole"
              render={({ field }) => (
                <FormItem className="grid gap-1.5">
                  <FormLabel className={labelCls}>Staff role</FormLabel>
                  <RhfSelect
                    value={field.value ?? ""}
                    onValueChange={(v) =>
                      field.onChange(v === "" ? undefined : (v as UserStaffRole))
                    }
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

          {accessPreviewStaffRole || targetRole === "client" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-body text-sm text-on-surface-variant">Inviting as</span>
              <PlatformRoleBadge
                targetRole={accessPreviewRole}
                targetStaffRole={accessPreviewStaffRole}
              />
            </div>
          ) : null}

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
