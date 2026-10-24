"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import type * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type StaffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md";
};

/** A focused task or confirmation over the page: 440px (560px for `md`), radius lg, shadow lg. */
export function StaffDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "sm",
}: StaffDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...STAFF_LAYER}
        overlayClassName="bg-staff-scrim"
        closeClassName="hidden"
        className={cn(
          "w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-staff-lg border border-staff-line bg-staff-raised p-0 text-staff-fg shadow-staff-lg sm:rounded-staff-lg",
          size === "md" ? "max-w-[560px]" : "max-w-[440px]",
        )}
      >
        <div className="flex flex-col gap-1.5 px-5 pt-5 pb-4">
          <DialogTitle className="font-staff-display text-staff-lg font-semibold tracking-normal text-staff-fg">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-staff-sm text-staff-muted">
              {description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </div>
        {children ? <div className="px-5 pb-4">{children}</div> : null}
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-staff-line bg-staff-sunken px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirms a consequential action. Says exactly what will happen; the confirm button repeats the
 * verb and amount ("Refund £20.00"), and danger actions are red.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "default",
  loading = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <StaffButton variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </StaffButton>
          <StaffButton
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </StaffButton>
        </>
      }
    >
      {children}
    </StaffDialog>
  );
}
