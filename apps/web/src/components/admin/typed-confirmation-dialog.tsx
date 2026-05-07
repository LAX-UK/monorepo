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
import { useEffect, useId, useState } from "react";

export type TypedConfirmationSeverity = "warning" | "danger";

export type TypedConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actionLabel: string;
  /** Exact string the user must type (case-sensitive). */
  confirmationPhrase: string;
  severity?: TypedConfirmationSeverity;
  onConfirm: () => void | Promise<void>;
};

/** shadcn-compatible destructive confirmation: submit disabled until exact phrase match. */
export function TypedConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  confirmationPhrase,
  severity = "danger",
  onConfirm,
}: TypedConfirmationDialogProps) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const matches = value === confirmationPhrase;
  const confirmVariant = severity === "warning" ? "secondary" : "destructive";

  async function handleConfirm() {
    if (!matches || pending) return;
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
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
            aria-invalid={value.length > 0 && !matches}
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
