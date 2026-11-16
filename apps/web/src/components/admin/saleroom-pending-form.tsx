"use client";

import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { StaffButton, type StaffButtonProps } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = Omit<StaffButtonProps, "type" | "onClick" | "loading" | "asChild"> & {
  pendingLabel: string;
  refreshOnComplete?: boolean;
  onRun: () => Promise<ActionResult<unknown>>;
  onSuccess?: () => void;
  successMessage?: string;
};

/**
 * A saleroom control button: runs a clerk command (`onRun`). It shows the pending wording and
 * ignores repeat presses while the request is in flight.
 */
export function SaleroomPendingSubmit({
  pendingLabel,
  children,
  refreshOnComplete = true,
  onRun,
  onSuccess,
  successMessage,
  ...buttonProps
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
