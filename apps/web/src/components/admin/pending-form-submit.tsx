"use client";

import { Button, type ButtonProps } from "@auction/ui/components/button";
import { useTransition } from "react";

type Props = Omit<ButtonProps, "type"> & {
  formId: string;
  pendingLabel: string;
};

/** Triggers form submit via useTransition for server-action forms. */
export function PendingFormSubmit({
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
