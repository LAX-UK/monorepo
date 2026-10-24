"use client";

import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";
import { useEffect, useId, useState } from "react";

export type TypedConfirmationSeverity = "warning" | "danger";

export type TypedConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Bullets shown above the typed confirmation input. */
  changeSummary?: readonly string[];
  /** e.g. "This will affect 12 lots in this sale" */
  relatedEntities?: { count: number; label: string };
  actionLabel: string;
  /** Exact string the user must type (case-sensitive). */
  confirmationPhrase: string;
  severity?: TypedConfirmationSeverity;
  /**
   * Asks for a written reason as well as the phrase. It is passed to `onConfirm`, and confirming
   * stays disabled until it has at least `minLength` characters.
   */
  reason?: { label: string; minLength: number; maxLength?: number };
  onConfirm: (reason: string) => void | Promise<void>;
};

/** shadcn-compatible destructive confirmation: submit disabled until exact phrase match. */
export function TypedConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  changeSummary,
  relatedEntities,
  actionLabel,
  confirmationPhrase,
  severity = "danger",
  reason,
  onConfirm,
}: TypedConfirmationDialogProps) {
  const inputId = useId();
  const reasonId = useId();
  const [value, setValue] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setValue("");
      setReasonText("");
    }
  }, [open]);

  const reasonOk = !reason || reasonText.trim().length >= reason.minLength;
  const matches = value === confirmationPhrase && reasonOk;
  const confirmVariant = severity === "warning" ? "secondary" : "destructive";

  async function handleConfirm() {
    if (!matches || pending) return;
    setPending(true);
    try {
      await onConfirm(reasonText.trim());
      onOpenChange(false);
    } catch {
      // Caller surfaces errors (e.g. toast); keep dialog open for retry.
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {changeSummary && changeSummary.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 font-body text-sm text-on-surface-variant">
            {changeSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {relatedEntities ? (
          <p className="rounded-md border border-warning/30 bg-warning-container/40 px-3 py-2 font-body text-sm text-on-surface">
            This will affect {relatedEntities.count} {relatedEntities.label}
            {relatedEntities.count === 1 ? "" : "s"}.
          </p>
        ) : null}
        {reason ? (
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{reason.label}</Label>
            <Textarea
              id={reasonId}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              maxLength={reason.maxLength ?? 500}
              rows={3}
              aria-describedby={`${reasonId}-hint`}
            />
            <p id={`${reasonId}-hint`} className="font-body text-xs text-on-surface-variant">
              At least {reason.minLength} characters. It is kept in the audit log.
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={inputId}>
            Type <span className="font-mono text-on-surface">{confirmationPhrase}</span> to confirm
          </Label>
          <Input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={value.length > 0 && value !== confirmationPhrase}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={!matches || pending}
            onClick={() => void handleConfirm()}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
