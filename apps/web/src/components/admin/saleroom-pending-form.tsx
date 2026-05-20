"use client";

import { Button, type ButtonProps } from "@auction/ui/components/button";
import { useTransition } from "react";

type Props = Omit<ButtonProps, "type"> & {
  formId: string;
  pendingLabel: string;
};

/** Submit button with useTransition pending state for saleroom server-action forms. */
export function SaleroomPendingSubmit({
  formId,
  pendingLabel,
  children,
  disabled,
  ...buttonProps
}: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={disabled || pending}
      {...buttonProps}
      onClick={() => {
        const form = document.getElementById(formId);
        if (!(form instanceof HTMLFormElement)) return;
        startTransition(() => {
          form.requestSubmit();
        });
      }}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
