"use client";

import { cn } from "@auction/ui";
/**
 * Admin delete UX tiers:
 * - Tier A (this component): immediate server persist — confirm before remove.
 * - Tier B: form staging — instant local remove inside multi-field forms; no dialog until Save.
 */
import { Button, type ButtonProps } from "@auction/ui/components/button";
import { ConfirmDialog, type ConfirmDialogTone } from "@auction/ui/components/confirm-dialog";
import { Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

type ConfirmedRemoveButtonProps = {
  ariaLabel: string;
  confirmTitle: string;
  confirmBody: ReactNode;
  confirmLabel?: string;
  tone?: ConfirmDialogTone;
  disabled?: boolean;
  /** External busy state (e.g. parent upload/save in flight). */
  loading?: boolean;
  onConfirmed: () => void | Promise<void>;
  className?: string;
} & (
  | {
      children: ReactNode;
      variant?: ButtonProps["variant"];
      size?: ButtonProps["size"];
    }
  | {
      children?: undefined;
      variant?: undefined;
      size?: undefined;
    }
);

/** Trash or text remove control that opens `ConfirmDialog` before running `onConfirmed`. */
export function ConfirmedRemoveButton({
  ariaLabel,
  confirmTitle,
  confirmBody,
  confirmLabel = "Remove",
  tone = "danger",
  disabled = false,
  loading = false,
  onConfirmed,
  className,
  children,
  variant,
  size,
}: ConfirmedRemoveButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isDisabled = disabled || loading || pending;

  return (
    <>
      {children ? (
        <Button
          type="button"
          variant={variant ?? "ghost"}
          size={size ?? "sm"}
          disabled={isDisabled}
          aria-label={ariaLabel}
          className={className}
          onClick={() => setOpen(true)}
        >
          {children}
        </Button>
      ) : (
        <button
          type="button"
          disabled={isDisabled}
          aria-label={ariaLabel}
          onClick={() => setOpen(true)}
          className={cn(
            "shrink-0 self-start rounded-md p-1 text-on-surface-variant/60 hover:bg-surface-container-low hover:text-error focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40",
            className,
          )}
        >
          <Trash2Icon className="size-4" aria-hidden />
        </button>
      )}
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
