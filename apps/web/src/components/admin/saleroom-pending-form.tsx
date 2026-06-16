"use client";

import { Button, type ButtonProps } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

type Props = Omit<ButtonProps, "type"> & {
  formId: string;
  pendingLabel: string;
  /** Refresh RSC payload after server action completes. */
  refreshOnComplete?: boolean;
};

/** Submit button with useTransition pending state for saleroom server-action forms. */
export function SaleroomPendingSubmit({
  formId,
  pendingLabel,
  children,
  disabled,
  refreshOnComplete = true,
  ...buttonProps
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && refreshOnComplete) {
      router.refresh();
    }
    wasPendingRef.current = pending;
  }, [pending, refreshOnComplete, router]);

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
