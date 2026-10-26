"use client";

/**
 * Admin delete UX tiers:
 * - Tier A (this component): immediate server persist — confirm before remove.
 * - Tier B: form staging — instant local remove inside multi-field forms; no dialog until Save.
 */
import { ConfirmActionDialog, StaffButton, type StaffButtonProps } from "@auction/staff-ui";
import { Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

type ConfirmedRemoveButtonProps = {
  ariaLabel: string;
  confirmTitle: string;
  confirmBody: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "info";
  disabled?: boolean;
  /** External busy state (e.g. parent upload/save in flight). */
  loading?: boolean;
  onConfirmed: () => void | Promise<void>;
  className?: string;
  /** A text button; without children the control is a trash icon button. */
  children?: ReactNode;
  variant?: StaffButtonProps["variant"];
};

/** Trash or text remove control that asks before running `onConfirmed`. */
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
}: ConfirmedRemoveButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isDisabled = disabled || loading || pending;

  return (
    <>
      {children ? (
        <StaffButton
          variant={variant ?? "ghost"}
          size="sm"
          disabled={isDisabled}
          aria-label={ariaLabel}
          {...(className ? { className } : {})}
          onClick={() => setOpen(true)}
        >
          {children}
        </StaffButton>
      ) : (
        <StaffButton
          variant="ghost"
          size="icon-sm"
          disabled={isDisabled}
          aria-label={ariaLabel}
          {...(className ? { className } : {})}
          onClick={() => setOpen(true)}
        >
          <Trash2Icon aria-hidden />
        </StaffButton>
      )}
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmTitle}
        description={confirmBody}
        confirmLabel={confirmLabel}
        tone={tone === "danger" ? "danger" : "default"}
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
