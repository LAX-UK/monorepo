"use client";

import { ConfirmActionDialog, StaffButton, type StaffButtonProps } from "@auction/staff-ui";
import { useState } from "react";

type Props = Omit<StaffButtonProps, "onClick" | "type"> & {
  formId: string;
  confirmTitle: string;
  confirmBody: string;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "info";
};

/** Asks first, then submits the target form by id. */
export function ConfirmFormSubmit({
  formId,
  confirmTitle,
  confirmBody,
  confirmLabel = "Confirm",
  tone = "danger",
  children,
  ...buttonProps
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <StaffButton {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </StaffButton>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmTitle}
        description={confirmBody}
        confirmLabel={confirmLabel}
        tone={tone === "danger" ? "danger" : "default"}
        onConfirm={() => {
          setOpen(false);
          const form = document.getElementById(formId);
          if (form instanceof HTMLFormElement) form.requestSubmit();
        }}
      />
    </>
  );
}
