"use client";

import {
  adminCapturePaymentResultAction,
  adminRefundPaymentResultAction,
} from "@/lib/actions/admin";
import type { PaymentsStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  KeyValueList,
  Notice,
  type OverflowAction,
  useStaffStepUp,
} from "@auction/staff-ui";
import { ADMIN_REFUND_BUYER_REASON_MIN } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Pending = { kind: "refund" | "capture"; payment: PaymentsStaffRow } | null;

function PaymentFacts({ payment }: { payment: PaymentsStaffRow }) {
  return (
    <div className="rounded-staff-lg border border-staff-line px-3 py-1">
      <KeyValueList
        items={[
          { label: "Lot", value: payment.lotTitle },
          { label: "Buyer", value: payment.buyer },
          { label: "Amount", value: payment.amount, numeric: true },
        ]}
      />
    </div>
  );
}

/**
 * Capture and refund for a payment, from a row's `…` menu or the record panel. Each opens a
 * confirm dialog that names the amount and the buyer; a refund also asks for a reason, kept on the
 * audit event. When the API asks for a fresh sign-in, the step-up dialog takes over.
 */
export function usePaymentMoneyActions({ canWritePayments }: { canWritePayments: boolean }) {
  const router = useRouter();
  const [pending, setPendingState] = useState<Pending>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const setPending = useCallback((next: Pending) => {
    setFailure(null);
    setPendingState(next);
  }, []);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const actionsFor = useCallback(
    (payment: PaymentsStaffRow): OverflowAction[] => {
      if (!canWritePayments) return [];
      const actions: OverflowAction[] = [];
      if (payment.canCapture) {
        actions.push({
          id: "capture",
          label: `Capture ${payment.amount}`,
          onSelect: () => setPending({ kind: "capture", payment }),
        });
      }
      if (payment.status !== "refunded") {
        actions.push({
          id: "refund",
          label: `Refund ${payment.amount}`,
          tone: "danger",
          onSelect: () => setPending({ kind: "refund", payment }),
          ...(payment.canRefund
            ? {}
            : { disabledReason: "Refunds open once the payment is captured" }),
        });
      }
      return actions;
    },
    [canWritePayments, setPending],
  );

  const run = (
    payment: PaymentsStaffRow,
    call: () => ReturnType<typeof adminCapturePaymentResultAction>,
    verb: string,
    done: string,
  ) => {
    setFailure(null);
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        setPending(null);
        notify.success(done);
        router.refresh();
        return;
      }
      if (stepUp.handle(result, `${verb} ${payment.amount}`)) {
        setPending(null);
        return;
      }
      // The dialog stays open with the reason typed, so the person can retry or cancel.
      setFailure(result.error);
    });
  };

  const failureNotice = (verb: string) =>
    failure ? (
      <Notice tone="danger" alert title={`The ${verb} did not go through`}>
        {failure}
      </Notice>
    ) : null;

  const dialogs = (
    <>
      <ConfirmActionDialog
        open={pending?.kind === "refund"}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={pending ? `Refund ${pending.payment.amount} to ${pending.payment.buyer}?` : "Refund"}
        description="The buyer gets the full amount back on their original payment method. A refund cannot be undone."
        confirmLabel={pending ? `Refund ${pending.payment.amount}` : "Refund"}
        tone="danger"
        loading={busy}
        reason={{
          label: "Reason for the refund",
          description: "Kept in the audit log with your name.",
          minLength: ADMIN_REFUND_BUYER_REASON_MIN,
        }}
        onConfirm={({ reason }) => {
          if (!pending) return;
          const { payment } = pending;
          run(
            payment,
            () => adminRefundPaymentResultAction(payment.id, { reason }),
            "refund",
            `Refunded ${payment.amount} to ${payment.buyer}`,
          );
        }}
      >
        {pending?.kind === "refund" ? (
          <>
            {failureNotice("refund")}
            <PaymentFacts payment={pending.payment} />
          </>
        ) : null}
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={pending?.kind === "capture"}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={
          pending ? `Capture ${pending.payment.amount} from ${pending.payment.buyer}?` : "Capture"
        }
        description="Takes the authorised amount and completes settlement for this lot."
        confirmLabel={pending ? `Capture ${pending.payment.amount}` : "Capture"}
        loading={busy}
        onConfirm={() => {
          if (!pending) return;
          const { payment } = pending;
          run(
            payment,
            () => adminCapturePaymentResultAction(payment.id),
            "capture",
            `Captured ${payment.amount}`,
          );
        }}
      >
        {pending?.kind === "capture" ? (
          <>
            {failureNotice("capture")}
            <PaymentFacts payment={pending.payment} />
          </>
        ) : null}
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

  return {
    actionsFor,
    refund: (payment: PaymentsStaffRow) => setPending({ kind: "refund", payment }),
    capture: (payment: PaymentsStaffRow) => setPending({ kind: "capture", payment }),
    dialogs,
  };
}
