"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  adminCapturePaymentResultAction,
  adminRefundPaymentResultAction,
} from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { PaymentStatus } from "@auction/types";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type PaymentActionsProps = { id: string; status: PaymentStatus; fullWidth?: boolean };

export function AdminPaymentActions({ id, status, fullWidth }: PaymentActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (status === "refunded") {
    return <span className="text-on-surface-variant">Refunded</span>;
  }

  const runCapture = () => {
    startTransition(() => {
      void (async () => {
        const r = await adminCapturePaymentResultAction(id);
        if (r.ok) {
          notify.success("Marked captured");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };
  const runRefund = () => {
    startTransition(() => {
      void (async () => {
        const r = await adminRefundPaymentResultAction(id);
        if (r.ok) {
          notify.success("Refunded");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  if (fullWidth) {
    return (
      <div className="flex flex-col gap-3 border-t border-border-hairline pt-4">
        {(status === "pending" || status === "authorized") && (
          <ConfirmActionButton
            className="min-h-11 w-full"
            disabled={pending}
            confirmTitle="Capture payment?"
            confirmBody="This marks the payment as captured and completes settlement."
            confirmLabel="Capture"
            tone="info"
            onConfirmed={runCapture}
          >
            Capture
          </ConfirmActionButton>
        )}
        <ConfirmActionButton
          variant="destructive"
          className="min-h-11 w-full"
          disabled={pending}
          confirmTitle="Refund payment?"
          confirmBody="This refunds the buyer and cannot be undone from this screen."
          confirmLabel="Refund"
          onConfirmed={runRefund}
        >
          Refund
        </ConfirmActionButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-3">
      {(status === "pending" || status === "authorized") && (
        <ConfirmActionButton
          size="sm"
          disabled={pending}
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
          confirmTitle="Capture payment?"
          confirmBody="This marks the payment as captured."
          confirmLabel="Capture"
          tone="info"
          onConfirmed={runCapture}
        >
          Capture
        </ConfirmActionButton>
      )}
      <ConfirmActionButton
        variant="destructive"
        size="sm"
        disabled={pending}
        className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
        confirmTitle="Refund payment?"
        confirmBody="This refunds the buyer."
        confirmLabel="Refund"
        onConfirmed={runRefund}
      >
        Refund
      </ConfirmActionButton>
    </div>
  );
}
