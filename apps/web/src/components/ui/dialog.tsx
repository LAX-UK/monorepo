"use client";

import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Dialog as UiDialog,
} from "@auction/ui/components/dialog";
import type { ReactNode } from "react";
import { useId } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const titleId = useId();

  return (
    <UiDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg gap-0 border border-outline-variant/20 bg-surface-container-lowest p-0 text-on-surface shadow-xl"
        aria-labelledby={titleId}
      >
        <DialogHeader className="border-b border-outline-variant/10 px-6 py-4 text-left">
          <DialogTitle
            id={titleId}
            className="font-headline text-2xl font-light tracking-tight text-on-surface"
          >
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">{children}</div>
      </DialogContent>
    </UiDialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <DialogDescription className="mb-6 font-body text-sm text-on-surface-variant">
        {message}
      </DialogDescription>
      <DialogFooter className="flex flex-row justify-end gap-3 sm:space-x-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          className={destructive ? "bg-error hover:opacity-95" : ""}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
