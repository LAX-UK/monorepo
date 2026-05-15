"use client";

import { adminApproveWithdrawalRequestResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = { lotId: string };

export function WithdrawalApproveButton({ lotId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await adminApproveWithdrawalRequestResultAction(lotId);
          if (r.ok) {
            notify.success("Withdrawal approved — lot cancelled");
            router.refresh();
          } else {
            notify.error("Approval failed", { description: r.error });
          }
        });
      }}
    >
      {pending ? "Approving…" : "Approve withdrawal"}
    </Button>
  );
}
