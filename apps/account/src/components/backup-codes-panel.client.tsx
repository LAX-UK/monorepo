"use client";

import { Button } from "@/components/account-button";
import { NOTICE, NoticeTitle } from "@/components/account-ui";
import { regenerateBackupCodesAction } from "@/server/application/account-identity-actions.server";
import type { BackupCodesActionResult } from "@/server/domain/account-action-result";
import {
  BACKUP_CODES_FILENAME,
  BACKUP_CODES_SAVE_NOTICE,
  REGENERATE_BACKUP_CODES_CONFIRM,
  formatBackupCodesFile,
} from "@/server/domain/account-backup-codes.vm";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BackupCodesPanelProps = {
  actionLabel: string;
  /** Where to come back to after a fresh sign-in, which creating codes may require. */
  returnTo: string;
};

type Issued = { codes: string[]; createdAt: Date };

/**
 * Creates a new set of backup codes and shows them once. The codes live only in this component's
 * state: they are not stored, not put in the URL and not shown again after "I've saved them", and
 * the page offers Copy and a .txt download because a code nobody saved is as good as none.
 */
export function BackupCodesPanel({ actionLabel, returnTo }: BackupCodesPanelProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  function closeConfirm() {
    if (busy) return;
    setConfirming(false);
    setError(null);
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    let result: BackupCodesActionResult;
    try {
      result = await regenerateBackupCodesAction();
    } catch {
      result = { status: "error", message: "We couldn't do that just now. Please try again." };
    }
    if (result.status === "reauth_required") {
      window.location.assign(buildReauthHref(returnTo));
      return;
    }
    setBusy(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setConfirming(false);
    setCopyNotice(null);
    setIssued({ codes: result.backupCodes, createdAt: new Date() });
    router.refresh();
  }

  async function copy(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopyNotice("Copied to your clipboard.");
    } catch {
      setCopyNotice("We couldn't copy them. Select the codes, or download them instead.");
    }
  }

  function download({ codes, createdAt }: Issued) {
    const url = URL.createObjectURL(
      new Blob([formatBackupCodesFile(codes, createdAt)], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = BACKUP_CODES_FILENAME;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {issued ? (
        <Alert variant="warning" aria-labelledby="new-backup-codes-heading" className={NOTICE}>
          <NoticeTitle level={3} id="new-backup-codes-heading">
            Your new backup codes
          </NoticeTitle>
          <AlertDescription>{BACKUP_CODES_SAVE_NOTICE}</AlertDescription>
          <ol
            aria-label="New backup codes"
            className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2"
          >
            {issued.codes.map((code) => (
              <li key={code}>
                <code className="font-label text-base font-medium tracking-wider text-on-surface tabular-nums select-all">
                  {code}
                </code>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => copy(issued.codes)}
            >
              Copy codes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => download(issued)}
            >
              Download (.txt)
            </Button>
            <Button
              type="button"
              variant="cta"
              className="min-h-11"
              onClick={() => {
                setIssued(null);
                setCopyNotice(null);
              }}
            >
              I've saved them
            </Button>
          </div>
          <output aria-live="polite" className="mt-2 block text-sm text-on-surface empty:hidden">
            {copyNotice}
          </output>
        </Alert>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setIssued(null);
            setConfirming(true);
          }}
        >
          {actionLabel}
        </Button>
      </div>
      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) closeConfirm();
          }}
          title={REGENERATE_BACKUP_CODES_CONFIRM.title}
          body={
            <>
              <p>{REGENERATE_BACKUP_CODES_CONFIRM.body}</p>
              {error ? (
                <p role="alert" className="mt-3 text-error">
                  {error}
                </p>
              ) : null}
            </>
          }
          confirmLabel={REGENERATE_BACKUP_CODES_CONFIRM.confirmLabel}
          loading={busy}
          onConfirm={regenerate}
        />
      ) : null}
    </div>
  );
}
