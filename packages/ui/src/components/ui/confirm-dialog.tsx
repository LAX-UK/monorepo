"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.js";
import { LoadingButton } from "./loading-button.js";

export type ConfirmDialogTone = "danger" | "warning" | "info";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

const confirmVariant: Record<ConfirmDialogTone, "destructive" | "default" | "secondary"> = {
  danger: "destructive",
  warning: "default",
  info: "secondary",
};

/** Standard confirmation for destructive or high-impact actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border-hairline">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className={cn("text-sm text-on-surface-variant")}>{body}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <LoadingButton
            type="button"
            variant={confirmVariant[tone]}
            loading={loading}
            loadingLabel="Working…"
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type UseConfirmDialogOptions = Omit<ConfirmDialogProps, "open" | "onOpenChange">;
