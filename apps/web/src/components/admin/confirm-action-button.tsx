"use client";

import { Button, type ButtonProps } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useState, useTransition } from "react";

type ConfirmActionButtonProps = Omit<ButtonProps, "onClick"> & {
  confirmTitle: string;
  confirmBody: string;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "info";
  onConfirmed: () => void | Promise<void>;
};

/** Button that opens `ConfirmDialog` before running `onConfirmed`. */
export function ConfirmActionButton({
  confirmTitle,
  confirmBody,
  confirmLabel = "Confirm",
  tone = "danger",
  onConfirmed,
  children,
  disabled,
  ...buttonProps
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        {...buttonProps}
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmTitle}
        body={confirmBody}
        confirmLabel={confirmLabel}
        tone={tone}
        loading={pending}
        onConfirm={() => {
          startTransition(async () => {
            await onConfirmed();
            setOpen(false);
          });
        }}
      />
    </>
  );
}
