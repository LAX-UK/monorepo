"use client";

import { Button, Dialog, Notice } from "@auction/ui/lax";
import { type ReactNode, useId, useRef } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The consequence, one paragraph per line, in plain words. */
  lines: readonly string[];
  confirmLabel: string;
  /** `danger` draws the final confirm in red; the page itself never has a red-filled button. */
  tone: "danger" | "default";
  pending: boolean;
  /** Why the server refused; the dialog stays open so the person can try again or cancel. */
  error: string | null;
  /**
   * Why confirming is not possible yet (the typed phrase does not match). The field's own label
   * says what to do, so the button is held until it is done and describes itself with this.
   */
  confirmBlockedReason?: string | null;
  onConfirm: () => void;
  children?: ReactNode;
};

/**
 * The frame for confirming a change to the team (remove, transfer ownership, leave): the title,
 * what will happen, an optional field, then Cancel and the verb. Focus starts on Cancel for a
 * destructive change, so Enter never removes someone by accident.
 */
export function MemberChangeDialog({
  open,
  onOpenChange,
  title,
  lines,
  confirmLabel,
  tone,
  pending,
  error,
  confirmBlockedReason,
  onConfirm,
  children,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}
      title={title}
      {...(tone === "danger" && !children ? { initialFocusRef: cancelRef } : {})}
      footer={
        <>
          <Button ref={cancelRef} disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={pending}
            disabled={Boolean(confirmBlockedReason)}
            aria-describedby={confirmBlockedReason ? reasonId : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-lax-14 text-lax-muted">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {children}
        {confirmBlockedReason ? (
          <p id={reasonId} className="sr-only">
            {confirmBlockedReason}
          </p>
        ) : null}
        {error ? <Notice tone="danger" alert title={error} /> : null}
      </div>
    </Dialog>
  );
}
