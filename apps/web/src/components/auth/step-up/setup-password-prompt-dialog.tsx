"use client";

import { StepUpDialogShell } from "@/components/auth/step-up/step-up-dialog-shell";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export function SetupPasswordPromptDialog({
  open,
  onCancel,
}: {
  open: boolean;
  onCancel: () => void;
}) {
  return (
    <StepUpDialogShell
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title="Add a password first"
      description={
        <>
          {AUTH_ERROR_MESSAGES.credential_required} You signed in with Google or Apple — set a
          password in security settings to use this action.
        </>
      }
      descriptionId="setup-password-desc"
      footer={
        <>
          <Button type="button" size="sm" asChild>
            <Link href="/dashboard/settings?tab=security#password-setup">Set up a password</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </>
      }
      footerClassName="flex-col gap-2 sm:flex-col"
    />
  );
}
