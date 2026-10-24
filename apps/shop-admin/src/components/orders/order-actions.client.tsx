"use client";

import { RefundDialog } from "@/components/orders/refund-dialog.client";
import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  cancelOrderAfterPossession,
  createProductionTask,
  updateFulfilment,
} from "@/server/application/admin-operations-actions.server";
import {
  fulfilmentNextOptions,
  orderLineLabel,
  presentFulfilmentStatus,
} from "@/server/domain/order-detail.vm";
import type { AdminOrderDetail } from "@auction/shop-contracts";
import type { ShopFulfilmentStatus } from "@auction/shop-domain";
import {
  ConfirmActionDialog,
  EnumSelect,
  Field,
  FieldRow,
  FormActions,
  OverflowMenu,
  StaffButton,
  TextInput,
  toast,
} from "@auction/staff-ui";
import { Copy, CreditCard, Factory, Undo2, XCircle } from "@auction/staff-ui/icons";
import { useState } from "react";

/**
 * The order page's actions. The refund button appears only for roles allowed to refund and only
 * while there is money left to refund; everything else sits in the overflow menu.
 */
export function OrderHeaderActions({
  detail,
  canRefund,
}: {
  detail: AdminOrderDetail;
  canRefund: boolean;
}) {
  const [refunding, setRefunding] = useState(false);
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
        ]}
      />
      {canRefund ? (
        <>
          <StaffButton
            variant="primary"
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

const NEEDS_TRACKING: readonly ShopFulfilmentStatus[] = ["in_transit"];

/**
 * Moves the fulfilment on. Only the statuses the fulfilment can reach next are offered, so an
 * impossible move cannot be chosen; tracking is asked for only when it is going in the post.
 */
export function FulfilmentUpdateForm({
  fulfilment,
}: {
  fulfilment: NonNullable<AdminOrderDetail["fulfilmentRecord"]>;
}) {
  const mutation = useAdminMutation();
  const options = fulfilmentNextOptions(fulfilment.status);
  const [status, setStatus] = useState<ShopFulfilmentStatus | null>(null);
  const [carrier, setCarrier] = useState(fulfilment.carrier ?? "");
  const [tracking, setTracking] = useState(fulfilment.trackingNumber ?? "");
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) {
    return (
      <p className="text-staff-sm text-staff-muted">
        {presentFulfilmentStatus(fulfilment.status).label} is final; there is nothing further to do.
      </p>
    );
  }
  const showTracking = status !== null && NEEDS_TRACKING.includes(status);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!status) {
          setError("Choose the next status.");
          return;
        }
        setError(null);
        const ok = await mutation.run(
          () =>
            updateFulfilment({
              fulfilmentId: fulfilment.fulfilmentId,
              status,
              ...(showTracking && carrier.trim() ? { carrier: carrier.trim() } : {}),
              ...(showTracking && tracking.trim() ? { trackingNumber: tracking.trim() } : {}),
              idempotencyKey: mutation.idempotencyKey,
            }),
          `Fulfilment moved to ${presentFulfilmentStatus(status).label.toLowerCase()}`,
        );
        if (ok) setStatus(null);
      }}
    >
      <Field label="Move to" error={error ?? mutation.message}>
        <EnumSelect
          value={status}
          onValueChange={(next) => {
            setStatus(next);
            setError(null);
          }}
          options={options}
          placeholder="Choose the next status"
        />
      </Field>
      {showTracking ? (
        <FieldRow>
          <Field label="Carrier" optional>
            <TextInput
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              placeholder="Royal Mail"
            />
          </Field>
          <Field label="Tracking number" optional>
            <TextInput value={tracking} onChange={(event) => setTracking(event.target.value)} />
          </Field>
        </FieldRow>
      ) : null}
      <FormActions>
        <StaffButton type="submit" variant="primary" loading={mutation.pending}>
          Update fulfilment
        </StaffButton>
      </FormActions>
    </form>
  );
}
