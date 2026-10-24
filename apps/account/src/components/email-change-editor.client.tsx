"use client";

import { Button, LoadingButton } from "@/components/account-button";
import { FIELD } from "@/components/account-ui";
import {
  cancelEmailChangeAction,
  startEmailChangeAction,
} from "@/server/application/account-identity-actions.server";
import type { AccountActionResult } from "@/server/domain/account-action-result";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type EmailChangeEditorProps = {
  /** The address a change is waiting on, already masked; null when none is in progress. */
  pendingEmailMasked: string | null;
  /** Where to come back to after a fresh sign-in, which starting a change may require. */
  returnTo: string;
};

type Notice = { kind: "error" | "success"; message: string };

/**
 * Change email, in place. Starting a change emails a link to the current and the new address;
 * nothing changes until both are followed, so this form only asks for the new address. While a
 * change is waiting the person sees which address it is for, and can cancel or start again.
 */
export function EmailChangeEditor({ pendingEmailMasked, returnTo }: EmailChangeEditorProps) {
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AccountActionResult>, after: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(returnTo));
        return;
      }
      if (result.status === "error") {
        setNotice({ kind: "error", message: result.message });
        return;
      }
      setNotice({ kind: "success", message: result.message });
      after();
      router.refresh();
    });
  }

  function send() {
    const trimmed = email.trim();
    if (!trimmed) {
      setNotice({ kind: "error", message: "Enter your new email address." });
      return;
    }
    run(
      () => startEmailChangeAction(trimmed),
      () => {
        setEditing(false);
        setEmail("");
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pendingEmailMasked ? (
        <p className="text-sm text-on-surface">
          Waiting for you to confirm the change to{" "}
          <span className="font-medium break-all">{pendingEmailMasked}</span>. Open the links we
          emailed to both addresses.
        </p>
      ) : null}
      {editing ? (
        <form
          className="flex flex-col gap-4 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>New email address</Label>
            <Input
              className={FIELD}
              id={inputId}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (notice) setNotice(null);
              }}
              aria-invalid={notice?.kind === "error" || undefined}
              aria-describedby={notice ? messageId : undefined}
            />
            <p className="text-xs text-on-surface-variant">
              We'll email a link to this address and to your current one. Your email address changes
              once you open both.
            </p>
          </div>
          <div id={messageId} aria-live="polite">
            {notice?.kind === "error" ? (
              <p role="alert" className="text-sm text-error">
                {notice.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <LoadingButton
              type="submit"
              variant="cta"
              loading={pending}
              loadingLabel="Sending…"
              className="min-h-11"
            >
              Send confirmation links
            </LoadingButton>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setNotice(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setNotice(null);
              setEditing(true);
            }}
          >
            {pendingEmailMasked ? "Use a different address" : "Change email"}
          </Button>
          {pendingEmailMasked ? (
            <LoadingButton
              type="button"
              variant="outline"
              loading={pending}
              loadingLabel="Cancelling…"
              className="min-h-11"
              onClick={() =>
                run(
                  () => cancelEmailChangeAction(),
                  () => undefined,
                )
              }
            >
              Cancel the change
            </LoadingButton>
          ) : null}
        </div>
      )}
      {!editing && notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={notice.kind === "error" ? "text-sm text-error" : "text-sm text-success"}
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  );
}
