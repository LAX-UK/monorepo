"use client";

import {
  refundManualReviewPaymentResultAction,
  releaseManualReviewPaymentResultAction,
} from "@/lib/actions/admin/admin-manual-review";
import type { ManualReviewStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
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

type Pending = { kind: "release" | "refund"; row: ManualReviewStaffRow; key: string } | null;

/** Why release is not offered for a compliance hold. */
export const COMPLIANCE_RELEASE_BLOCKED = "Released once the MLRO clears the compliance case";

function HeldPaymentFacts({ row }: { row: ManualReviewStaffRow }) {
  return (
    <div className="rounded-staff-lg border border-staff-line px-3 py-1">
      <KeyValueList
        items={[
          { label: "Lot", value: row.lotTitle },
          { label: "Winner", value: row.winner },
          { label: "Amount", value: row.amount, numeric: true },
          { label: "Hold", value: row.reason },
        ]}
      />
    </div>
  );
}

/**
 * Release and refund for a payment held in manual review, from the row's `…` menu or the record
 * panel. Each opens a confirm dialog naming the amount and the winner; a refund asks for a reason
 * kept on the audit event. Compliance holds cannot be released here. When the API asks for a
 * fresh sign-in, the step-up dialog takes over.
 */
export function useManualReviewActions({ canResolve }: { canResolve: boolean }) {
  const router = useRouter();
  const [pending, setPendingState] = useState<Pending>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const open = useCallback((kind: "release" | "refund", row: ManualReviewStaffRow) => {
    setFailure(null);
    setPendingState({ kind, row, key: crypto.randomUUID() });
  }, []);
  const close = () => {
    if (!busy) setPendingState(null);
  };

  const actionsFor = useCallback(
    (row: ManualReviewStaffRow): OverflowAction[] => {
      if (!canResolve) return [];
      return [
        {
          id: "release",
          label: "Release for checkout",
          onSelect: () => open("release", row),
          ...(row.compliance ? { disabledReason: COMPLIANCE_RELEASE_BLOCKED } : {}),
        },
        {
          id: "refund",
          label: `Refund ${row.amount}`,
          tone: "danger",
          onSelect: () => open("refund", row),
        },
      ];
    },
    [canResolve, open],
  );

  const run = (
    call: () => ReturnType<typeof releaseManualReviewPaymentResultAction>,
    label: string,
    done: string,
  ) => {
    setFailure(null);
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        setPendingState(null);
        notify.success(done);
        router.refresh();
        return;
      }
      if (stepUp.handle(result, label)) {
        setPendingState(null);
        return;
      }
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
        open={pending?.kind === "release"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title={pending ? `Release ${pending.row.amount} for checkout?` : "Release for checkout"}
        description="The winner can check out again, usually by UK bank transfer for high-value lots. No money is taken until Stripe confirms the payment."
        confirmLabel="Release for checkout"
        loading={busy}
        onConfirm={() => {
          if (!pending) return;
          const { row, key } = pending;
          run(
            () => releaseManualReviewPaymentResultAction(row.id, { idempotencyKey: key }),
            "Release for checkout",
            `Released ${row.amount} for checkout`,
          );
        }}
      >
        {pending?.kind === "release" ? (
          <>
            {failureNotice("release")}
            <HeldPaymentFacts row={pending.row} />
          </>
        ) : null}
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={pending?.kind === "refund"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title={pending ? `Refund ${pending.row.amount} to ${pending.row.winner}?` : "Refund"}
        description="The winning payment is refunded and the lot does not settle. A refund cannot be undone."
        confirmLabel={pending ? `Refund ${pending.row.amount}` : "Refund"}
        tone="danger"
        loading={busy}
        reason={{
          label: "Reason for the refund",
          description: "Kept in the audit log with your name.",
          minLength: ADMIN_REFUND_BUYER_REASON_MIN,
        }}
        onConfirm={({ reason }) => {
          if (!pending) return;
          const { row, key } = pending;
          run(
            () => refundManualReviewPaymentResultAction(row.id, { reason, idempotencyKey: key }),
            `Refund ${row.amount}`,
            `Refunded ${row.amount} to ${row.winner}`,
          );
        }}
      >
        {pending?.kind === "refund" ? (
          <>
            {failureNotice("refund")}
            <HeldPaymentFacts row={pending.row} />
          </>
        ) : null}
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

  return {
    actionsFor,
    release: (row: ManualReviewStaffRow) => open("release", row),
    refund: (row: ManualReviewStaffRow) => open("refund", row),
    dialogs,
  };
}
