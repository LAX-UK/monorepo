"use client";

import { Button } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/typography";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="max-w-lg rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-black/40"
      onClose={onClose}
    >
      <div className="border-b border-outline-variant/10 px-6 py-4">
        <DisplayHeading as="h2" className="text-2xl">
          {title}
        </DisplayHeading>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
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
      <p className="mb-6 font-body text-sm text-on-surface-variant">{message}</p>
      <div className="flex justify-end gap-3">
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
      </div>
    </Dialog>
  );
}
