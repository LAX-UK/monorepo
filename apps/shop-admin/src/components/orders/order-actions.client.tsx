"use client";

import { GuestErasureDialog } from "@/components/orders/guest-erasure-dialog.client";
import { RefundDialog } from "@/components/orders/refund-dialog.client";
import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  cancelOrderAfterPossession,
  createProductionTask,
} from "@/server/application/admin-operations-actions.server";
import { GUEST_ERASURE_COPY, guestErasureMenuReason } from "@/server/domain/guest-erasure.vm";
import { orderLineLabel } from "@/server/domain/order-detail.vm";
import type { AdminGuestErasureState, AdminOrderDetail } from "@auction/shop-contracts";
import { ConfirmActionDialog, OverflowMenu, StaffButton, toast } from "@auction/staff-ui";
import { Copy, CreditCard, Eraser, Factory, Undo2, XCircle } from "@auction/staff-ui/icons";
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

/** A line's own actions: cancelling after possession needs the line's edition, taken from it. */
export function OrderLineMenu({ line, canCancel }: { line: Line; canCancel: boolean }) {
  const mutation = useAdminMutation();
  const [confirming, setConfirming] = useState(false);
  if (!canCancel || !line.editionId) return null;
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
        description="Use this when the customer returns an item they already have. The edition goes back into stock; refund the customer separately."
        confirmLabel="Cancel item"
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
