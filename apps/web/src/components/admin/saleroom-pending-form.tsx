"use client";

import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { StaffButton, type StaffButtonProps } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

type BaseProps = Omit<StaffButtonProps, "type" | "onClick" | "loading" | "asChild"> & {
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

/**
 * A saleroom control button: submits a form (`formId`) or runs a server action (`onRun`). It
 * shows the pending wording and ignores repeat presses while the request is in flight.
 */
export function SaleroomPendingSubmit(props: Props) {
  const { pendingLabel, children, refreshOnComplete = true, ...rest } = props;
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
      <StaffButton
        {...buttonProps}
        loading={pending}
        onClick={() => {
          const form = document.getElementById(formId);
          if (!(form instanceof HTMLFormElement)) return;
          startTransition(() => {
            form.requestSubmit();
          });
        }}
      >
        {pending ? pendingLabel : children}
      </StaffButton>
    );
  }

  const { onRun, onSuccess, successMessage, ...buttonProps } = rest as Omit<
    ActionRunProps,
    keyof BaseProps
  >;

  return (
    <StaffButton
      {...buttonProps}
      loading={pending}
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
    </StaffButton>
  );
}
