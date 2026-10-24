"use client";

import { StaffButton, StaffDialog } from "@auction/staff-ui";
import { type ReactNode, type RefObject, useId } from "react";

/**
 * A form in a dialog: Cancel and one submit button whose label names the outcome ("Create hold",
 * "Mark £85.00 paid"). The submit button lives in the dialog's footer and submits the form in its
 * body, so Enter in a field submits and the footer stays in view on a phone.
 */
export function StaffFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pending,
  onSubmit,
  size = "sm",
  initialFocusRef,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  pending: boolean;
  onSubmit: () => void;
  size?: "sm" | "md";
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const formId = useId();
  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description ? { description } : {})}
      size={size}
      {...(initialFocusRef ? { initialFocusRef } : {})}
      footer={
        <>
          <StaffButton variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={formId} variant="primary" loading={pending}>
            {submitLabel}
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
      </form>
    </StaffDialog>
  );
}
