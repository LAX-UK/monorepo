"use client";

import { ConfirmActionDialog, Notice } from "@auction/staff-ui";
import { useEffect, useState } from "react";

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
   * is refused until it has at least `minLength` characters.
   */
  reason?: { label: string; minLength: number; maxLength?: number };
  /** A rejection keeps the dialog open and shows its message. */
  onConfirm: (reason: string) => void | Promise<void>;
};

/** A confirmation where the person types an exact phrase before the action is allowed. */
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
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setFailure(null);
  }, [open]);

  async function handleConfirm({ reason: reasonText }: { reason: string }) {
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      await onConfirm(reasonText);
      onOpenChange(false);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "That did not go through.");
    } finally {
      setPending(false);
    }
  }

  const hasBody = (changeSummary && changeSummary.length > 0) || relatedEntities || failure;

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description ?? ""}
      confirmLabel={actionLabel}
      tone={severity === "danger" ? "danger" : "default"}
      loading={pending}
      typedConfirmation={confirmationPhrase}
      {...(reason
        ? {
            reason: {
              label: reason.label,
              minLength: reason.minLength,
              ...(reason.maxLength ? { maxLength: reason.maxLength } : {}),
              description: `At least ${reason.minLength} characters. It is kept in the audit log.`,
            },
          }
        : {})}
      onConfirm={handleConfirm}
    >
      {hasBody ? (
        <div className="flex flex-col gap-3">
          {changeSummary && changeSummary.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-staff-sm text-staff-muted">
              {changeSummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {relatedEntities ? (
            <Notice tone="warning" title="Other records are affected">
              This will affect {relatedEntities.count} {relatedEntities.label}
              {relatedEntities.count === 1 ? "" : "s"}.
            </Notice>
          ) : null}
          {failure ? (
            <Notice tone="danger" alert title="That did not go through">
              {failure}
            </Notice>
          ) : null}
        </div>
      ) : null}
    </ConfirmActionDialog>
  );
}
