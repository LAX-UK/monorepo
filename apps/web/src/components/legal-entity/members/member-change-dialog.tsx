"use client";

import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { type ReactNode, useRef } from "react";

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
  /** Why confirming is not possible yet (the typed phrase does not match). */
  confirmBlockedReason?: string | null;
  onConfirm: () => void;
  children?: ReactNode;
};

/**
 * The frame for confirming a change to the team: the title, what will happen, an optional field,
 * then Cancel and the verb. Focus starts on Cancel for a destructive change, so Enter never
 * removes someone by accident.
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
  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent
        className="max-w-md rounded-xl border-border-hairline"
        onOpenAutoFocus={(event) => {
          if (tone !== "danger" || children) return;
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="pr-6 font-headline text-lg leading-6.5 font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 font-body text-sm leading-5.5 text-on-surface-variant">
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>
        {children}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            size="default"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <LoadingButton
            type="button"
            variant={tone === "danger" ? "destructive" : "primary"}
            size="default"
            loading={pending}
            disabledReason={confirmBlockedReason ?? undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
