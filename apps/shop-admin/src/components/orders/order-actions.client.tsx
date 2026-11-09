"use client";

import { GuestErasureDialog } from "@/components/orders/guest-erasure-dialog.client";
import { RefundDialog } from "@/components/orders/refund-dialog.client";
import { RefundedOutsideDialog } from "@/components/orders/refund-outside-dialog.client";
import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  cancelOrderAfterPossession,
  createProductionTask,
  retryOrderRefund,
  updateFramingTask,
} from "@/server/application/admin-operations-actions.server";
import { GUEST_ERASURE_COPY, guestErasureMenuReason } from "@/server/domain/guest-erasure.vm";
import {
  cancelAfterPossessionDescription,
  framingDueLabel,
  orderLineLabel,
  presentFramingTaskStatus,
} from "@/server/domain/order-detail.vm";
import type { AdminGuestErasureState, AdminOrderDetail } from "@auction/shop-contracts";
import {
  type CancellationStockOutcome,
  type FramingTaskStatus,
  framingTaskFinished,
  framingTaskNextSteps,
} from "@auction/shop-domain";
import {
  ConfirmActionDialog,
  OverflowMenu,
  StaffButton,
  StatusBadge,
  formatGbp,
  toast,
} from "@auction/staff-ui";
import {
  Copy,
  CreditCard,
  Eraser,
  Factory,
  HandCoins,
  RotateCw,
  Undo2,
  XCircle,
} from "@auction/staff-ui/icons";
import { useState } from "react";

/**
 * The order page's actions. The refund button appears only for roles allowed to refund and only
 * while there is money left to refund; everything else sits in the overflow menu, with erasing a
 * guest's data last, as the one destructive action, saying why when it has to wait.
 */
export function OrderHeaderActions({
  detail,
  canRefund,
  guestErasure = null,
}: {
  detail: AdminOrderDetail;
  canRefund: boolean;
  /** A guest's order, for people who may erase guest data: whether it can happen now. */
  guestErasure?: { state: AdminGuestErasureState; email: string } | null;
}) {
  const [refunding, setRefunding] = useState(false);
  const [erasing, setErasing] = useState(false);
  return (
    <>
      <OverflowMenu
        actions={[
          {
            id: "copy",
            label: "Copy order ID",
            icon: Copy,
            onSelect: () => {
              void navigator.clipboard
                ?.writeText(detail.orderId)
                .then(() => toast.success("Order ID copied"));
            },
          },
          ...(detail.stripePaymentIntentId
            ? [
                {
                  id: "stripe",
                  label: "View payment in Stripe",
                  icon: CreditCard,
                  onSelect: () =>
                    window.open(
                      `https://dashboard.stripe.com/payments/${encodeURIComponent(detail.stripePaymentIntentId ?? "")}`,
                      "_blank",
                      "noopener",
                    ),
                },
              ]
            : []),
          ...(guestErasure
            ? [
                {
                  id: "erase-guest",
                  label: GUEST_ERASURE_COPY.menuItem,
                  icon: Eraser,
                  tone: "danger" as const,
                  requires: "lead.erase",
                  ...(guestErasure.state.allowed
                    ? {}
                    : {
                        disabledReason:
                          guestErasureMenuReason(guestErasure.state, detail.reference) ??
                          GUEST_ERASURE_COPY.unavailable,
                      }),
                  onSelect: () => setErasing(true),
                },
              ]
            : []),
        ]}
      />
      {guestErasure ? (
        <GuestErasureDialog
          open={erasing}
          onOpenChange={setErasing}
          guestCustomerId={guestErasure.state.guestCustomerId}
          email={guestErasure.email}
        />
      ) : null}
      {canRefund ? (
        <>
          <StaffButton
            variant="primary"
            requires="refund.write"
            icon={<Undo2 aria-hidden />}
            onClick={() => setRefunding(true)}
          >
            Refund
          </StaffButton>
          <RefundDialog detail={detail} open={refunding} onOpenChange={setRefunding} />
        </>
      ) : null}
    </>
  );
}

type Line = AdminOrderDetail["lines"][number];

/**
 * A line's production: send it with one click (its edition comes from the line, so nothing is
 * typed), shown as pending at once and confirmed by the refresh.
 */
export function SendToProductionButton({ line }: { line: Line }) {
  const mutation = useAdminMutation();
  const [sent, setSent] = useState(false);
  if (!line.editionId) return null;
  const editionId = line.editionId;
  if (sent) {
    return <span className="text-staff-sm text-staff-muted">Sending…</span>;
  }
  return (
    <StaffButton
      size="sm"
      variant="secondary"
      requires="production.write"
      icon={<Factory aria-hidden />}
      loading={mutation.pending}
      onClick={async () => {
        setSent(true);
        const ok = await mutation.run(
          () =>
            createProductionTask({
              orderLineId: line.orderLineId,
              editionId,
              idempotencyKey: mutation.idempotencyKey,
            }),
          `${orderLineLabel(line)} sent to production`,
        );
        if (!ok) {
          setSent(false);
          toast.error("Could not send to production. Try again.");
        }
      }}
    >
      Send to production
    </StaffButton>
  );
}

const FRAMING_STEP_LABEL: Partial<Record<FramingTaskStatus, string>> = {
  framing: "Start framing",
  framed: "Mark framed",
  completed: "Mark done",
};

/**
 * The one step that moves a frame's work on (start, framed, done), with the version staff saw so
 * a change made meanwhile is refused. Shown nowhere once the work cannot move.
 */
export function FramingStepButton({
  task,
  label,
  canMove,
}: {
  task: { taskId: string; status: FramingTaskStatus; version: number };
  /** What the toast names: "Framing: Natural oak frame". */
  label: string;
  canMove: boolean;
}) {
  const mutation = useAdminMutation();
  const next = canMove
    ? framingTaskNextSteps(task.status).find((step) => FRAMING_STEP_LABEL[step])
    : undefined;
  if (!next) return null;
  return (
    <StaffButton
      size="sm"
      variant="secondary"
      requires="production.write"
      loading={mutation.pending}
      onClick={() =>
        mutation.run(
          () =>
            updateFramingTask({
              taskId: task.taskId,
              status: next,
              expectedVersion: task.version,
              idempotencyKey: mutation.idempotencyKey,
            }),
          `${label}: ${presentFramingTaskStatus(next).label.toLowerCase()}`,
        )
      }
    >
      {FRAMING_STEP_LABEL[next]}
    </StaffButton>
  );
}

/**
 * A frame's work on the order page: when it is due, where it stands and the step that moves it
 * on. Cancelling the framing is not offered here; it goes with a refund of the frame.
 */
export function FramingTaskControl({ line, canMove }: { line: Line; canMove: boolean }) {
  const task = line.framing?.task;
  if (!task) return null;
  const presented = presentFramingTaskStatus(task.status);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {!framingTaskFinished(task.status) ? (
        <span className="whitespace-nowrap text-staff-xs text-staff-muted tabular-nums">
          {framingDueLabel(task.dueAt)}
        </span>
      ) : null}
      <StatusBadge tone={presented.tone}>{presented.label}</StatusBadge>
      <FramingStepButton task={task} label={orderLineLabel(line)} canMove={canMove} />
    </span>
  );
}

/**
 * Puts a failed refund back in the queue to be sent to the customer's card. The same refund is
 * reused, so retrying twice never refunds twice.
 */
export function RetryRefundButton({ refundId, label }: { refundId: string; label: string }) {
  const mutation = useAdminMutation();
  return (
    <div className="flex flex-col items-end gap-1">
      <StaffButton
        size="sm"
        variant="secondary"
        requires="refund.write"
        icon={<RotateCw aria-hidden />}
        loading={mutation.pending}
        aria-label={`Retry refund of ${label}`}
        onClick={() =>
          mutation.run(
            () => retryOrderRefund({ refundId, idempotencyKey: mutation.idempotencyKey }),
            "Refund sent again",
          )
        }
      >
        Retry refund
      </StaffButton>
      {mutation.message ? (
        <p role="alert" className="text-staff-xs text-staff-danger">
          {mutation.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What staff can do with a refund that failed for good: send it again, or, when the customer was
 * refunded another way, record that. The second asks for the reference and a reason.
 */
export function FailedRefundActions({
  refundId,
  amountPence,
  itemLabel,
  failureReason,
}: {
  refundId: string;
  amountPence: number;
  itemLabel: string;
  failureReason: string | null;
}) {
  const [settling, setSettling] = useState(false);
  return (
    <>
      <RetryRefundButton refundId={refundId} label={formatGbp(amountPence)} />
      <StaffButton
        size="sm"
        variant="secondary"
        requires="refund.write"
        icon={<HandCoins aria-hidden />}
        aria-label={`Mark refund of ${formatGbp(amountPence)} as refunded outside LAX`}
        onClick={() => setSettling(true)}
      >
        Mark as refunded outside LAX
      </StaffButton>
      {settling ? (
        <RefundedOutsideDialog
          refundId={refundId}
          amountPence={amountPence}
          itemLabel={itemLabel}
          failureReason={failureReason}
          open={settling}
          onOpenChange={setSettling}
        />
      ) : null}
    </>
  );
}

/**
 * A line's own actions: cancelling after possession needs the line's edition, taken from it, and
 * says exactly what it refunds.
 */
export function OrderLineMenu({
  line,
  cancellation,
}: {
  line: Line;
  /** What cancelling does; null when the line cannot be cancelled. */
  cancellation: {
    refundPence: number;
    framePence: number;
    stock: CancellationStockOutcome;
  } | null;
}) {
  const mutation = useAdminMutation();
  const [confirming, setConfirming] = useState(false);
  if (cancellation === null || !line.editionId) return null;
  const { refundPence, framePence, stock } = cancellation;
  const editionId = line.editionId;
  return (
    <>
      <OverflowMenu
        size="icon-sm"
        label={`Actions for ${orderLineLabel(line)}`}
        actions={[
          {
            id: "cancel",
            requires: "refund.write",
            label: "Cancel after possession…",
            icon: XCircle,
            tone: "danger",
            onSelect: () => setConfirming(true),
          },
        ]}
      />
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Cancel ${orderLineLabel(line)}?`}
        description={cancelAfterPossessionDescription(refundPence, stock, framePence)}
        confirmLabel={`Cancel and refund ${formatGbp(refundPence + framePence)}`}
        tone="danger"
        loading={mutation.pending}
        onConfirm={async () => {
          const ok = await mutation.run(
            () =>
              cancelOrderAfterPossession({
                orderLineId: line.orderLineId,
                editionId,
                idempotencyKey: mutation.idempotencyKey,
              }),
            "Item cancelled",
          );
          if (ok) setConfirming(false);
        }}
      >
        {mutation.message ? (
          <p role="alert" className="text-staff-sm text-staff-danger">
            {mutation.message}
          </p>
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
