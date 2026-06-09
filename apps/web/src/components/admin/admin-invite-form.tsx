"use client";

import { RhfSelect } from "@/components/ui/rhf-select";
import { adminCreateInvitationResultAction } from "@/lib/actions/admin";
import { partitionInviteEmails } from "@/lib/admin/parse-invite-email-list";
import { staffRoleFilterOptions } from "@/lib/admin/staff-role-presenter";
import { useActionForm } from "@/lib/forms/use-action-form";
import { type UserRole, userRoles } from "@auction/types";
import type { UserStaffRole } from "@auction/types";
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
import { useEffect, useState } from "react";
import { useWatch } from "react-hook-form";

function roleLabel(r: UserRole): string {
  if (r === "staff") return "Staff";
  return "Client";
}

const roleOptions = userRoles.map((r) => ({ value: r, label: roleLabel(r) }));

const staffRoleOptions = staffRoleFilterOptions.map((o) => ({
  value: o.value,
  label: o.label,
}));

type BatchFailure = { email: string; message: string };

export function AdminInviteForm() {
  const router = useRouter();
  const [batchSummary, setBatchSummary] = useState<string | null>(null);
  const [batchFailures, setBatchFailures] = useState<BatchFailure[]>([]);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

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

  async function handleBatchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBatchSummary(null);
    setBatchFailures([]);

    const values = form.getValues();
    const { valid, invalid } = partitionInviteEmails(values.email);
    if (invalid.length > 0) {
      form.setError("email", {
        message: `Invalid email${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}`,
      });
      return;
    }
    if (valid.length === 0) {
      form.setError("email", { message: "Enter at least one email address" });
      return;
    }
    if (values.targetRole === "staff" && values.targetStaffRole == null) {
      form.setError("targetStaffRole", {
        message: "Select a staff role",
      });
      return;
    }

    if (valid.length === 1) {
      form.setValue("email", valid[0] ?? "");
      await onSubmit(e);
      return;
    }

    setIsBatchSubmitting(true);
    let sent = 0;
    const failures: BatchFailure[] = [];

    for (const email of valid) {
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

    if (sent > 0) {
      form.reset({
        email: "",
        targetRole: values.targetRole,
        targetStaffRole: values.targetStaffRole,
      });
      router.refresh();
    }

    if (failures.length === 0) {
      setBatchSummary(`${sent} invitation${sent === 1 ? "" : "s"} sent`);
      return;
    }

    setBatchFailures(failures);
    const failDetail = failures.map((f) => `${f.email}: ${f.message}`).join("; ");
    setBatchSummary(`${sent} sent, ${failures.length} failed (${failDetail})`);
  }

  const submitting = isSubmitting || isBatchSubmitting;

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
      {batchSummary ? (
        <output
          className={`block rounded-sm border px-4 py-3 text-sm ${
            batchFailures.length > 0
              ? "border-warning/40 bg-warning-container/20 text-on-surface"
              : "border-success/40 bg-success-container/20 text-on-surface"
          }`}
        >
          {batchSummary}
        </output>
      ) : null}
      <Form {...form}>
        <form
          onSubmit={handleBatchSubmit}
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
                    type="text"
                    autoComplete="email"
                    placeholder="one@example.com or paste multiple"
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
          <Button
            type="submit"
            className="min-h-11 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
