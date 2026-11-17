"use client";

import {
  ClerkRoomRecheckContext,
  settleUnknownOutcome,
} from "@/features/saleroom/lib/clerk-room-recheck";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { StaffButton, type StaffButtonProps } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useContext, useId, useTransition } from "react";

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
 *
 * A command that fails or goes unanswered may still have landed, so it is never sent again and
 * never reported as done: the button says the outcome is unknown, re-reads the room (the clerk
 * console's recheck, or a page refresh outside it), then shows the error.
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
  const recheckRoom = useContext(ClerkRoomRecheckContext);
  const toastId = useId();

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
            await settleUnknownOutcome(
              recheckRoom ?? (async () => router.refresh()),
              r.error,
              toastId,
            );
          })();
        });
      }}
    >
      {pending ? pendingLabel : children}
    </StaffButton>
  );
}
