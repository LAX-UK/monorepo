"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Field, TextArea, TextInput, useReturnFocus } from "@auction/ui/lax";
import * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type StaffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** 440px; `md` 560px for forms; `lg` 960px for looking at images. */
  size?: "sm" | "md" | "lg";
  /** Where focus lands when the dialog opens; by default the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

const DIALOG_WIDTH: Record<NonNullable<StaffDialogProps["size"]>, string> = {
  sm: "max-w-[440px]",
  md: "max-w-[560px]",
  lg: "max-w-[960px]",
};

/**
 * A focused task or confirmation over the page: 440px (560px for `md`), radius lg, shadow lg. A
 * tall body scrolls between the fixed title and footer, so the actions stay in reach on a phone.
 */
export function StaffDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "sm",
  initialFocusRef,
}: StaffDialogProps) {
  const returnFocus = useReturnFocus(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...STAFF_LAYER}
        overlayClassName="bg-staff-scrim"
        closeClassName="hidden"
        onCloseAutoFocus={returnFocus}
        {...(initialFocusRef
          ? {
              onOpenAutoFocus: (event: Event) => {
                if (!initialFocusRef.current) return;
                event.preventDefault();
                initialFocusRef.current.focus();
              },
            }
          : {})}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-staff-lg border border-staff-line bg-staff-raised p-0 text-staff-fg shadow-staff-lg sm:rounded-staff-lg",
          DIALOG_WIDTH[size],
        )}
      >
        <div className="flex shrink-0 flex-col gap-1.5 px-5 pt-5 pb-4">
          <DialogTitle className="font-staff text-staff-lg font-semibold tracking-normal text-staff-fg">
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
        {children ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        ) : null}
        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-staff-line bg-staff-sunken px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** A required, audited reason for a consequential action ("Why are you banning this bidder?"). */
export type ConfirmReason = {
  label: string;
  /** Guidance under the label, e.g. who will read it. */
  description?: React.ReactNode;
  /** Fewest characters accepted; at least 1. */
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  /**
   * A one-line answer, such as a bank or transfer reference, in a single-line field where Enter
   * confirms. Reasons in sentences keep the default multi-line field.
   */
  singleLine?: boolean;
  /** Said when the field is left empty, e.g. "Enter the reference from the transfer." */
  missingMessage?: string;
};

export type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A question naming the action and the record: "Refund £20.00 to Ada Lovelace?" */
  title: string;
  /** What will happen, plainly, including what cannot be undone. */
  description: React.ReactNode;
  /** Repeats the verb and amount: "Refund £20.00". Never "OK" or "Yes". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  /** Called with the reason, when one is asked for. */
  onConfirm: (details: { reason: string }) => void;
  /** Asks for a reason, kept in the audit log; confirming checks it is long enough. */
  reason?: ConfirmReason;
  /**
   * For rare, catastrophic actions only: the person types this text (the record's name or
   * reference) and the confirm button stays disabled until it matches exactly.
   */
  typedConfirmation?: string;
  children?: React.ReactNode;
};

/**
 * Confirms a consequential action. Says exactly what will happen; the confirm button repeats the
 * verb and amount ("Refund £20.00"), and danger actions are red. Focus starts on Cancel, so
 * Enter never confirms by accident. Friction scales with damage: add
 * a `reason` for actions that are audited, and `typedConfirmation` for the catastrophic few.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  onConfirm,
  reason,
  typedConfirmation,
  children,
}: ConfirmActionDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const reasonRef = React.useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const typedRef = React.useRef<HTMLInputElement>(null);
  const [reasonText, setReasonText] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [typed, setTyped] = React.useState("");
  const minLength = Math.max(1, reason?.minLength ?? 1);

  React.useEffect(() => {
    if (open) return;
    setReasonText("");
    setReasonError(null);
    setTyped("");
  }, [open]);

  const typedMatches = typedConfirmation === undefined || typed === typedConfirmation;
  // Cancel takes focus first, even when there is a reason or phrase to type, so Enter or a
  // stray key never starts the action; the person tabs on to the field.
  const initialFocusRef = cancelRef;

  const confirm = () => {
    const trimmed = reasonText.trim();
    if (reason && trimmed.length < minLength) {
      setReasonError(
        trimmed.length === 0 && reason.missingMessage
          ? reason.missingMessage
          : minLength > 1
            ? `Enter a reason of at least ${minLength} characters.`
            : `Enter ${reason.label.toLowerCase()}.`,
      );
      reasonRef.current?.focus();
      return;
    }
    if (!typedMatches) return;
    onConfirm({ reason: trimmed });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      initialFocusRef={initialFocusRef}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </StaffButton>
          <StaffButton
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            disabled={!typedMatches}
            onClick={confirm}
          >
            {confirmLabel}
          </StaffButton>
        </>
      }
    >
      {children || reason || typedConfirmation !== undefined ? (
        <div className="flex flex-col gap-4">
          {children}
          {reason ? (
            <Field
              label={reason.label}
              description={reason.description}
              error={reasonError}
              disabled={loading}
            >
              {reason.singleLine ? (
                <TextInput
                  ref={reasonRef}
                  value={reasonText}
                  maxLength={reason.maxLength ?? 500}
                  placeholder={reason.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setReasonText(event.target.value);
                    if (reasonError && event.target.value.trim().length >= minLength) {
                      setReasonError(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (!loading) confirm();
                  }}
                />
              ) : (
                <TextArea
                  ref={reasonRef}
                  value={reasonText}
                  maxLength={reason.maxLength ?? 500}
                  placeholder={reason.placeholder}
                  onChange={(event) => {
                    setReasonText(event.target.value);
                    if (reasonError && event.target.value.trim().length >= minLength) {
                      setReasonError(null);
                    }
                  }}
                />
              )}
            </Field>
          ) : null}
          {typedConfirmation !== undefined ? (
            <Field
              label={
                <span>
                  Type{" "}
                  <span className="rounded-staff-xs bg-staff-sunken px-1 font-mono text-staff-fg">
                    {typedConfirmation}
                  </span>{" "}
                  to confirm
                </span>
              }
              disabled={loading}
            >
              <TextInput
                ref={typedRef}
                value={typed}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && typed === typedConfirmation) {
                    event.preventDefault();
                    confirm();
                  }
                }}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
    </StaffDialog>
  );
}
