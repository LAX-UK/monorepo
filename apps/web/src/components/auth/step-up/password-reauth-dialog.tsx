"use client";

import { StepUpDialogShell } from "@/components/auth/step-up/step-up-dialog-shell";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useEffect, useState } from "react";

export function PasswordReauthDialog({
  open,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (!open) setPw("");
  }, [open]);

  return (
    <StepUpDialogShell
      open={open}
      onOpenChange={(o) => !o && !busy && onCancel()}
      title="Confirm your password"
      description="For your security, enter your current password to continue."
      descriptionId="password-reauth-desc"
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !pw.trim()}
            onClick={() => onSubmit(pw.trim())}
          >
            {busy ? "Checking…" : "Confirm"}
          </Button>
        </>
      }
      footerClassName="gap-2 sm:gap-0"
    >
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-error/30 bg-error-container/10 px-3 py-2 font-body text-sm text-error"
        >
          {error}
        </p>
      ) : null}
      <label htmlFor="step-up-password" className="sr-only">
        Password
      </label>
      <input
        id="step-up-password"
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoComplete="current-password"
        disabled={busy}
        className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-primary"
        onKeyDown={(e) => {
          if (e.key === "Enter" && pw.trim()) onSubmit(pw.trim());
        }}
      />
      <p className="font-body text-xs text-on-surface-variant">
        <Link href="/forgot-password" className="text-link underline-offset-2 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </StepUpDialogShell>
  );
}
