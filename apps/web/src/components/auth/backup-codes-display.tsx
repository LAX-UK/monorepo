"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Label } from "@auction/ui/components/label";
import { useCallback, useState } from "react";

export type BackupCodesDisplayProps = {
  codes: string[];
  /** When set, user must tick before calling onConfirm */
  requireConfirmation?: boolean;
  confirmationLabel?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  disabled?: boolean;
};

export function BackupCodesDisplay({
  codes,
  requireConfirmation = false,
  confirmationLabel = "I've saved these codes in a safe place.",
  onConfirm,
  confirmLabel = "Done",
  disabled = false,
}: BackupCodesDisplayProps) {
  const [confirmed, setConfirmed] = useState(false);

  const copyAll = useCallback(() => {
    void navigator.clipboard.writeText(codes.join("\n"));
  }, [codes]);

  const downloadTxt = useCallback(() => {
    const blob = new Blob([`${codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lax-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [codes]);

  const canFinish = !requireConfirmation || confirmed;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-live="polite">
        {codes.map((code) => (
          <div
            key={code}
            className="rounded-lg border border-outline-variant/25 bg-surface-container-low px-3 py-2 font-mono text-sm text-on-surface"
          >
            {code}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void copyAll()}>
          Copy all
        </Button>
        <Button type="button" variant="tertiary" onClick={downloadTxt}>
          Download .txt
        </Button>
      </div>
      {requireConfirmation ? (
        <div className="flex items-start gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low/40 p-3">
          <Checkbox
            id="backup-saved"
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(v === true)}
            disabled={disabled}
            aria-describedby="backup-saved-hint"
          />
          <div className="space-y-1">
            <Label
              htmlFor="backup-saved"
              className="cursor-pointer font-body text-sm text-on-surface"
            >
              {confirmationLabel}
            </Label>
            <p id="backup-saved-hint" className="font-body text-xs text-on-surface-variant">
              Each code works once. If you lose access to your authenticator, you&apos;ll need a
              backup code or account recovery via support.
            </p>
          </div>
        </div>
      ) : null}
      {onConfirm ? (
        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={disabled || !canFinish}
          onClick={() => onConfirm()}
        >
          {confirmLabel}
        </Button>
      ) : null}
    </div>
  );
}
