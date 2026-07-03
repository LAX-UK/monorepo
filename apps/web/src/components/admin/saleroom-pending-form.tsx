"use client";

import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { Button, type ButtonProps } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

type BaseProps = Omit<ButtonProps, "type" | "onClick"> & {
  pendingLabel: string;
  refreshOnComplete?: boolean;
};

type FormSubmitProps = BaseProps & {
  formId: string;
  onRun?: never;
  onSuccess?: never;
  successMessage?: never;
};

type ActionRunProps = BaseProps & {
  onRun: () => Promise<ActionResult<unknown>>;
  onSuccess?: () => void;
  successMessage?: string;
  formId?: never;
};

type Props = FormSubmitProps | ActionRunProps;

function isFormSubmitProps(props: Props): props is FormSubmitProps {
  return "formId" in props && props.formId != null;
}

/** Saleroom control button — legacy form submit (`formId`) or ActionResult server action (`onRun`). */
export function SaleroomPendingSubmit(props: Props) {
  const { pendingLabel, children, disabled, refreshOnComplete = true, ...rest } = props;
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (!isFormSubmitProps(props)) return;
    if (wasPendingRef.current && !pending && refreshOnComplete) {
      router.refresh();
    }
    wasPendingRef.current = pending;
  }, [pending, refreshOnComplete, router, props]);

  if (isFormSubmitProps(props)) {
    const { formId, ...buttonProps } = rest as Omit<FormSubmitProps, keyof BaseProps>;
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

  const { onRun, onSuccess, successMessage, ...buttonProps } = rest as Omit<
    ActionRunProps,
    keyof BaseProps
  >;

  return (
    <Button
      type="button"
      disabled={disabled || pending}
      {...buttonProps}
      onClick={() => {
        startTransition(() => {
          void (async () => {
            const r = await onRun();
            if (r.ok) {
              onSuccess?.();
              if (successMessage) notify.success(successMessage);
              if (refreshOnComplete) router.refresh();
              return;
            }
            notify.error(r.error);
          })();
        });
      }}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
