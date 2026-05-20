"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import type { ButtonProps } from "@auction/ui/components/button";
import { useRef } from "react";

type Props = Omit<ButtonProps, "onClick" | "type"> & {
  formId: string;
  confirmTitle: string;
  confirmBody: string;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "info";
};

/** Opens confirm dialog, then submits the target form by id. */
export function ConfirmFormSubmit({
  formId,
  confirmTitle,
  confirmBody,
  confirmLabel,
  tone,
  children,
  ...buttonProps
}: Props) {
  const submitted = useRef(false);

  return (
    <ConfirmActionButton
      {...buttonProps}
      confirmTitle={confirmTitle}
      confirmBody={confirmBody}
      {...(confirmLabel ? { confirmLabel } : {})}
      {...(tone ? { tone } : {})}
      onConfirmed={() => {
        if (submitted.current) return;
        submitted.current = true;
        const form = document.getElementById(formId);
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
        submitted.current = false;
      }}
    >
      {children}
    </ConfirmActionButton>
  );
}
