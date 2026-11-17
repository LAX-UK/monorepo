"use client";

import * as React from "react";
import { StaffButton } from "../primitives/button.js";
import { StaffDialog } from "./staff-dialog.js";

export type StaffFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Names the outcome ("Decline and email the buyer"), never "OK" or "Submit". */
  submitLabel: string;
  cancelLabel?: string;
  /** The submit button shows it is working, and Cancel and closing wait for it. */
  pending: boolean;
  onSubmit: () => void;
  tone?: "default" | "danger";
  size?: "sm" | "md";
  /** Where focus lands when the dialog opens; by default the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** An accessible name for the form; the dialog title by default. */
  formLabel?: string;
  children: React.ReactNode;
};

/**
 * A form in a dialog: Cancel and one submit button whose label names the outcome. The submit
 * button lives in the dialog's footer and submits the form in its body, so Enter in a one-line
 * field submits and the footer stays in view on a phone. While `pending`, the dialog cannot be
 * closed, so a decision on its way is never abandoned half-sent.
 */
export function StaffFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel = "Cancel",
  pending,
  onSubmit,
  tone = "default",
  size = "sm",
  initialFocusRef,
  formLabel,
  children,
}: StaffFormDialogProps) {
  const formId = React.useId();
  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={title}
      {...(description ? { description } : {})}
      size={size}
      {...(initialFocusRef ? { initialFocusRef } : {})}
      footer={
        <>
          <StaffButton variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </StaffButton>
          <StaffButton
            type="submit"
            form={formId}
            variant={tone === "danger" ? "danger" : "primary"}
            loading={pending}
          >
            {submitLabel}
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={formLabel ?? title}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) onSubmit();
        }}
      >
        {children}
      </form>
    </StaffDialog>
  );
}
