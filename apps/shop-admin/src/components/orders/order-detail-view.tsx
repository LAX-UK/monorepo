import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { FulfilmentSection } from "@/components/orders/fulfilment-section.client";
import {
  FailedRefundActions,
  FramingTaskControl,
  OrderHeaderActions,
  OrderLineMenu,
  SendToProductionButton,
} from "@/components/orders/order-actions.client";
import { PickAndPackPanel } from "@/components/orders/pick-and-pack-panel.client";
import { ReturnsPanel } from "@/components/orders/returns-panel.client";
import { guestErasedLine } from "@/server/domain/guest-erasure.vm";
import {
  buildOrderTimeline,
  canRefundOrder,
  cancelledLineBadge,
  failedRefunds,
  framedPrintLabel,
  framesHoldingDispatch,
  framingCanMove,
  framingRefundState,
  lineCancellation,
  lineCancellationRefund,
  orderItemCountLabel,
  orderLineLabel,
  presentFramingTaskStatus,
  presentOrderStatus,
  presentProductionStatus,
  presentRefundStatus,
  refundFailureMessage,
  refundRowContext,
  settledOutsideNote,
} from "@/server/domain/order-detail.vm";
import { orderBuyerAccountLabel, orderNumber } from "@/server/domain/order-list.vm";
import { cancelledLineStock, orderReturnRows } from "@/server/domain/order-returns.vm";
import type {
  AdminGuestErasureState,
  AdminOrderDetail,
  AdminPickAndPack,
} from "@auction/shop-contracts";
import {
  KeyValueList,
  MappedStatusBadge,
  MetaItem,
  Notice,
  PageHeader,
  Section,
  StatusBadge,
  Timeline,
  formatGbp,
  formatStaffDateTime,
} from "@auction/staff-ui";
import Link from "next/link";

export type OrderPermissions = {
  refund: boolean;
  fulfilment: boolean;
  production: boolean;
  /** Sending a print another party owns in place of the one sold (shop admins). */
  swapAcrossOwners: boolean;
  /** Erasing a guest buyer's personal data on request. */
  eraseGuest: boolean;
};

/** Capability names as the session lists them; the API checks the same ones. */
export function orderPermissions(capabilities: readonly string[]): OrderPermissions {
  return {
    refund: capabilities.includes("refund.write"),
    fulfilment: capabilities.includes("fulfilment.write"),
    production: capabilities.includes("production.write"),
    swapAcrossOwners: capabilities.includes("print_swap.cross_owner"),
    eraseGuest: capabilities.includes("lead.erase"),
  };
}

/**
 * One order: what was bought, where it is, what was refunded and everything that happened, with
 * the actions this person's role allows. Main column for the work, side column for reference.
 */
export function OrderDetailView({
  detail,
  permissions,
  guestErasure = null,
  pickAndPack = null,
}: {
  detail: AdminOrderDetail;
  permissions: OrderPermissions;
  /** The order's prints and where packing has got to; absent when it could not be read. */
  pickAndPack?: AdminPickAndPack | null;
  /** Loaded only for a guest's order, for people who may erase guest data. */
  guestErasure?: AdminGuestErasureState | null;
}) {
  const number = orderNumber(detail.orderId, detail.reference);
  const erased = detail.personalDataErasedAt ? guestErasedLine(detail.personalDataErasedAt) : null;
  const buyer =
    detail.buyerName ?? detail.buyerEmail ?? (erased ? "Erased guest" : "Unknown buyer");
  const failed = failedRefunds(detail);
  const returnRows = orderReturnRows(detail);
  const failedPence = failed.reduce((sum, refund) => sum + refund.amountPence, 0);
  const refundedPence = detail.refunds
    .filter((refund) => refund.status !== "failed" && refund.status !== "cancelled")
    .reduce((sum, refund) => sum + refund.amountPence, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Orders", href: "/orders" }}
            current={`Order ${number}`}
          />
        }
        title={`Order ${number}`}
        status={<MappedStatusBadge status={detail.status} present={presentOrderStatus} />}
        meta={
          <>
            <MetaItem label="Total">{formatGbp(detail.totalPence)}</MetaItem>
            <MetaItem label={detail.buyerIsGuest ? "Guest buyer" : "Buyer"}>{buyer}</MetaItem>
            <MetaItem label="Placed">{formatStaffDateTime(detail.createdAt)}</MetaItem>
          </>
        }
        primaryAction={
          <OrderHeaderActions
            detail={detail}
            canRefund={permissions.refund && canRefundOrder(detail)}
            guestErasure={
              guestErasure && !erased && detail.buyerEmail
                ? { state: guestErasure, email: detail.buyerEmail }
                : null
            }
          />
        }
      />

      {failed.length > 0 ? (
        <Notice
          tone="danger"
          alert
          title={
            failed.length === 1
              ? `A refund of ${formatGbp(failedPence)} could not be sent`
              : `${failed.length} refunds, ${formatGbp(failedPence)} in total, could not be sent`
          }
        >
          The customer has not been refunded. The artist's payout for a cancelled item stays held
          until its refund goes through.
          {permissions.refund
            ? " Retry it from the Refunds list below, or mark it as refunded outside LAX if the customer was refunded another way."
            : ""}
        </Notice>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Items" description={orderItemCountLabel(detail)} bodyClassName="p-0">
            <ul className="divide-y divide-staff-line-subtle">
              {detail.lines.map((line) => {
                const cancellationRefund = lineCancellationRefund(detail, line.orderLineId);
                const cancelledBadge = cancellationRefund
                  ? cancelledLineBadge(cancellationRefund)
                  : null;
                const stockBadge = cancellationRefund
                  ? cancelledLineStock(detail, line.orderLineId)
                  : null;
                return (
                  <li
                    key={line.orderLineId}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-staff-sm font-medium text-staff-fg">
                        {orderLineLabel(line)}
                      </p>
                      <p className="text-staff-xs text-staff-muted tabular-nums">
                        {formatGbp(line.unitPricePence)}
                        {line.sku ? ` · ${line.sku}` : ""}
                        {framedPrintLabel(detail, line)
                          ? ` · for ${framedPrintLabel(detail, line)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {line.kind === "framing" ? (
                        permissions.production ? (
                          <FramingTaskControl
                            line={line}
                            canMove={framingCanMove(detail, line)}
                            refund={framingRefundState(detail, line)}
                          />
                        ) : line.framing?.task ? (
                          <StatusBadge
                            tone={presentFramingTaskStatus(line.framing.task.status).tone}
                          >
                            {presentFramingTaskStatus(line.framing.task.status).label}
                          </StatusBadge>
                        ) : null
                      ) : line.production ? (
                        <span className="flex items-center gap-2 text-staff-xs text-staff-muted">
                          Production
                          {permissions.production ? (
                            <Link
                              href={`/production/${line.production.taskId}`}
                              className="staff-focus rounded-staff-xs"
                              aria-label={`Open the production task for ${orderLineLabel(line)}`}
                            >
                              <StatusBadge
                                tone={presentProductionStatus(line.production.status).tone}
                              >
                                {presentProductionStatus(line.production.status).label}
                              </StatusBadge>
                            </Link>
                          ) : (
                            <StatusBadge
                              tone={presentProductionStatus(line.production.status).tone}
                            >
                              {presentProductionStatus(line.production.status).label}
                            </StatusBadge>
                          )}
                        </span>
                      ) : permissions.production && line.editionId && !cancelledBadge ? (
                        <SendToProductionButton line={line} />
                      ) : null}
                      {cancelledBadge ? (
                        <>
                          <StatusBadge tone={cancelledBadge.tone}>
                            {cancelledBadge.label}
                          </StatusBadge>
                          {stockBadge ? (
                            <StatusBadge tone={stockBadge.tone}>{stockBadge.label}</StatusBadge>
                          ) : null}
                        </>
                      ) : null}
                      <OrderLineMenu
                        line={line}
                        cancellation={permissions.refund ? lineCancellation(detail, line) : null}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>

          {pickAndPack ? (
            <PickAndPackPanel
              pack={pickAndPack}
              canWrite={permissions.fulfilment}
              canSwapAcrossOwners={permissions.swapAcrossOwners}
            />
          ) : null}

          <ReturnsPanel rows={returnRows} canWrite={permissions.fulfilment} />

          {framesHoldingDispatch(detail) > 0 ? (
            <Notice
              tone="info"
              title={`Ready to dispatch waits for ${framesHoldingDispatch(detail)} ${
                framesHoldingDispatch(detail) === 1 ? "frame" : "frames"
              } to be finished`}
            >
              Finish the framing from the item list or the Production page.
            </Notice>
          ) : null}

          <FulfilmentSection
            fulfilment={detail.fulfilmentRecord}
            fallbackOption={detail.fulfilment}
            paidAt={detail.paidAt}
            canEdit={permissions.fulfilment}
          />

          <Section
            title="Refunds"
            {...(refundedPence > 0
              ? { description: `${formatGbp(refundedPence)} refunded or pending` }
              : {})}
            {...(detail.refunds.length ? { bodyClassName: "p-0" } : {})}
          >
            {detail.refunds.length === 0 ? (
              <p className="text-staff-sm text-staff-muted">No refunds on this order.</p>
            ) : (
              <ul className="divide-y divide-staff-line-subtle">
                {detail.refunds.map((refund) => {
                  const line = detail.lines.find(
                    (candidate) => candidate.orderLineId === refund.orderLineId,
                  );
                  return (
                    <li
                      key={refund.refundId}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-staff-sm font-medium text-staff-fg tabular-nums">
                          {formatGbp(refund.amountPence)}
                        </p>
                        <p className="text-staff-xs text-staff-muted">
                          {refundRowContext(
                            refund,
                            line,
                            line ? framedPrintLabel(detail, line) : null,
                          )}
                        </p>
                        {refund.status === "failed" && refund.failureReason ? (
                          <p className="text-staff-xs text-staff-danger">
                            Not sent: {refundFailureMessage(refund.failureReason)}
                          </p>
                        ) : null}
                        {settledOutsideNote(refund) ? (
                          <p className="text-staff-xs text-staff-muted">
                            {settledOutsideNote(refund)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        {refund.settledOutside ? (
                          <StatusBadge tone="success">Refunded outside LAX</StatusBadge>
                        ) : (
                          <MappedStatusBadge status={refund.status} present={presentRefundStatus} />
                        )}
                        {refund.status === "failed" && permissions.refund ? (
                          <FailedRefundActions
                            refundId={refund.refundId}
                            amountPence={refund.amountPence}
                            itemLabel={line ? orderLineLabel(line) : "Whole order"}
                            failureReason={refundFailureMessage(refund.failureReason)}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Customer" bodyClassName="flex flex-col gap-3">
            <KeyValueList
              items={[
                // An erased guest has no name or email left; the rows would only read "—".
                ...(erased
                  ? []
                  : [
                      { label: "Name", value: detail.buyerName },
                      {
                        label: "Email",
                        value: detail.buyerEmail,
                        ...(detail.buyerEmail ? { copyValue: detail.buyerEmail } : {}),
                      },
                    ]),
                // Kept for the accounting record; the API sends it only to people who handle invoices.
                ...(detail.retainedInvoiceContact
                  ? [
                      { label: "Invoice name", value: detail.retainedInvoiceContact.name },
                      {
                        label: "Invoice address",
                        value: detail.retainedInvoiceContact.addressLines.join(", ") || null,
                      },
                    ]
                  : []),
                detail.buyerIsGuest
                  ? { label: "Account", value: orderBuyerAccountLabel(detail) }
                  : {
                      label: "Account",
                      value: orderBuyerAccountLabel(detail),
                      copyValue: detail.buyerSubjectId,
                    },
              ]}
            />
            {erased ? <p className="m-0 text-staff-xs text-staff-muted">{erased}</p> : null}
          </Section>
          <Section title="Payment">
            <KeyValueList
              items={[
                { label: "Total", value: formatGbp(detail.totalPence), numeric: true },
                {
                  label: "Paid",
                  value: detail.paidAt ? formatStaffDateTime(detail.paidAt) : "Not paid",
                },
                ...(detail.stripePaymentIntentId
                  ? [
                      {
                        label: "Stripe payment",
                        value: `${detail.stripePaymentIntentId.slice(0, 14)}…`,
                        copyValue: detail.stripePaymentIntentId,
                      },
                    ]
                  : []),
              ]}
            />
          </Section>
          <Section title="Activity">
            <Timeline label="Order activity" events={buildOrderTimeline(detail)} />
          </Section>
        </div>
      </div>
    </div>
  );
}
