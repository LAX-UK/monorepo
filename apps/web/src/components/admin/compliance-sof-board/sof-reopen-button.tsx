"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { sofReopenAction } from "@/lib/actions/compliance";
import { notify } from "@/lib/ui/notify";
import type { ButtonProps } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";

type Props = Omit<ButtonProps, "onClick" | "type"> & {
  caseId: string;
  confirmTitle?: string;
  confirmBody?: string;
  confirmLabel?: string;
};

export function SofReopenButton({
  caseId,
  confirmTitle = "Reopen rejected case?",
  confirmBody = "Maker-checker fields will be cleared and the case returns to pending review.",
  confirmLabel = "Reopen for review",
  children,
  ...buttonProps
}: Props) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      {...buttonProps}
      confirmTitle={confirmTitle}
      confirmBody={confirmBody}
      confirmLabel={confirmLabel}
      tone="warning"
      onConfirmed={async () => {
        const r = await sofReopenAction({ caseId });
        if (!r.ok) {
          notify.error(r.error);
          throw new Error(r.error);
        }
        notify.success("Rejected case reopened for review");
        router.refresh();
      }}
    >
      {children}
    </ConfirmActionButton>
  );
}
