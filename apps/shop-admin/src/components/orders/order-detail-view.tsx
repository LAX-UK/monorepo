import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { FulfilmentSection } from "@/components/orders/fulfilment-section.client";
import { GuestErasureAction } from "@/components/orders/guest-erasure-action.client";
import {
  OrderHeaderActions,
  OrderLineMenu,
  SendToProductionButton,
} from "@/components/orders/order-actions.client";
import { guestErasedNotice } from "@/server/domain/guest-erasure.vm";
import {
  buildOrderTimeline,
  canRefundOrder,
  orderLineLabel,
  presentOrderStatus,
  presentProductionStatus,
  presentRefundStatus,
} from "@/server/domain/order-detail.vm";
import { orderBuyerAccountLabel, orderNumber } from "@/server/domain/order-list.vm";
import type { AdminGuestErasureState, AdminOrderDetail } from "@auction/shop-contracts";
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
  humanizeStatus,
} from "@auction/staff-ui";
import Link from "next/link";

export type OrderPermissions = {
  refund: boolean;
  fulfilment: boolean;
  production: boolean;
  /** Erasing a guest buyer's personal data on request. */
  eraseGuest: boolean;
};

/** Capability names as the session lists them; the API checks the same ones. */
export function orderPermissions(capabilities: readonly string[]): OrderPermissions {
  return {
    refund: capabilities.includes("refund.write"),
    fulfilment: capabilities.includes("fulfilment.write"),
    production: capabilities.includes("production.write"),
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
}: {
  detail: AdminOrderDetail;
  permissions: OrderPermissions;
  /** Loaded only for a guest's order, for people who may erase guest data. */
  guestErasure?: AdminGuestErasureState | null;
}) {
  const number = orderNumber(detail.orderId, detail.reference);
  const erased = detail.personalDataErasedAt
    ? guestErasedNotice(detail.personalDataErasedAt)
    : null;
  const buyer =
    detail.buyerName ?? detail.buyerEmail ?? (erased ? "Erased guest" : "Unknown buyer");
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
          />
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title="Items"
            description={`${detail.lines.length} on this order`}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-staff-line-subtle">
              {detail.lines.map((line) => (
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
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {line.production ? (
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
                          <StatusBadge tone={presentProductionStatus(line.production.status).tone}>
                            {presentProductionStatus(line.production.status).label}
                          </StatusBadge>
                        )}
                      </span>
                    ) : permissions.production && line.editionId ? (
                      <SendToProductionButton line={line} />
                    ) : null}
                    <OrderLineMenu line={line} canCancel={permissions.refund} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>

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
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-staff-sm font-medium text-staff-fg tabular-nums">
                          {formatGbp(refund.amountPence)}
                        </p>
                        <p className="truncate text-staff-xs text-staff-muted">
                          {line ? orderLineLabel(line) : "Whole order"} ·{" "}
                          {humanizeStatus(refund.source)} · {formatStaffDateTime(refund.createdAt)}
                        </p>
                      </div>
                      <MappedStatusBadge status={refund.status} present={presentRefundStatus} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Customer" bodyClassName="flex flex-col gap-3">
            {erased ? (
              <Notice tone="info" title={erased.title}>
                {erased.body}
              </Notice>
            ) : null}
            <KeyValueList
              items={[
                { label: "Name", value: detail.buyerName },
                {
                  label: "Email",
                  value: detail.buyerEmail,
                  ...(detail.buyerEmail ? { copyValue: detail.buyerEmail } : {}),
                },
                detail.buyerIsGuest
                  ? { label: "Account", value: orderBuyerAccountLabel(detail) }
                  : {
                      label: "Account",
                      value: orderBuyerAccountLabel(detail),
                      copyValue: detail.buyerSubjectId,
                    },
              ]}
            />
            {guestErasure && !erased && detail.buyerEmail ? (
              <GuestErasureAction state={guestErasure} email={detail.buyerEmail} />
            ) : null}
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
