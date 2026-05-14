"use client";

import { cn } from "@auction/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import type { ReactNode } from "react";

/**
 * Shared Radix dialog chrome (title, description, body slot, optional footer).
 * Copy and primary actions live in leaf components — this module is layout only.
 */
export function StepUpDialogShell({
  open,
  onOpenChange,
  title,
  description,
  descriptionId,
  children,
  footer,
  contentClassName,
  footerClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  descriptionId: string;
  children?: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  footerClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-sm", contentClassName)} aria-describedby={descriptionId}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id={descriptionId}>{description}</DialogDescription>
        </DialogHeader>
        {children}
        {footer ? <DialogFooter className={footerClassName}>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
