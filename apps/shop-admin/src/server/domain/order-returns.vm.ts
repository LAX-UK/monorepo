import type { AdminOrderDetail, AdminOrderReturn } from "@auction/shop-contracts";
import {
  SHOP_RETURN_STATUSES,
  type ShopReturnDisposition,
  type ShopReturnStatus,
  isShopReturnDisposition,
  isShopReturnStatus,
  nextReturnStatuses,
} from "@auction/shop-domain";
import {
  type StatusPresentation,
  type WizardStep,
  formatStaffDate,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { orderLineLabel } from "./order-detail.vm";
import { staffStatus } from "./staff-status";

/*
 * How an order's returns read: the steps an item goes through on its way back, what staff can do
 * next, and what happened to the stock when it arrived. Pure, so the rules are tested without
 * rendering.
 */

/** The steps shown for a return, in order. Cancelled returns are shown as a status instead. */
export const RETURN_STEPS: readonly WizardStep[] = [
  { id: "requested", label: "Requested" },
  { id: "in_transit", label: "In transit" },
  { id: "received", label: "Received" },
];

const PROGRESS_STATUSES: readonly ShopReturnStatus[] = SHOP_RETURN_STATUSES.filter(
  (status) => status !== "cancelled",
);

/** Which step a return is on; a closed return has no step. */
export function returnStepIndex(status: ShopReturnStatus): number | null {
  const index = PROGRESS_STATUSES.indexOf(status);
  return index === -1 ? null : index;
}

/** What staff can do to a return next, by the status it will move to. */
export type ReturnAction = "mark_in_transit" | "receive";

const ACTION_FOR_NEXT_STATUS: Partial<Record<ShopReturnStatus, ReturnAction>> = {
  in_transit: "mark_in_transit",
  received: "receive",
};

export const RETURN_ACTION_LABELS: Record<ReturnAction, string> = {
  mark_in_transit: "Mark in transit",
  receive: "Mark received…",
};

export function returnAction(status: ShopReturnStatus): ReturnAction | null {
  const next = nextReturnStatuses(status)[0];
  return next ? (ACTION_FOR_NEXT_STATUS[next] ?? null) : null;
}

/** What staff decide for an item that has come back. */
export type ReceiveChoice = {
  value: ShopReturnDisposition;
  label: string;
  description: string;
  confirmLabel: string;
};

export const RECEIVE_CHOICES: readonly ReceiveChoice[] = [
  {
    value: "back_on_sale",
    label: "Back on sale",
    description:
      "Put the print back in stock. Anyone waiting to hear about this edition is told it is available.",
    confirmLabel: "Receive and put back on sale",
  },
  {
    value: "withdrawn_damaged",
    label: "Withdraw (damaged)",
    description: "Take the print out of stock. It is not offered for sale again.",
    confirmLabel: "Receive and withdraw",
  },
];

export const DEFAULT_RECEIVE_DISPOSITION: ShopReturnDisposition = "back_on_sale";

const OUTCOME: Record<ShopReturnDisposition, StatusPresentation> = {
  back_on_sale: { label: "Back on sale", tone: "success" },
  withdrawn_damaged: { label: "Withdrawn, damaged", tone: "neutral" },
};

export type ReturnRowView = {
  returnId: string;
  item: string;
  status: ShopReturnStatus;
  statusLabel: StatusPresentation;
  /** Step index for the progress indicator; null for a closed return. */
  step: number | null;
  action: ReturnAction | null;
  /** What happened to the stock, once received. */
  outcome: StatusPresentation | null;
  /** The line under the item: when it was requested and, once it arrived, when. */
  context: string;
};

function viewOf(detail: AdminOrderDetail, row: AdminOrderReturn): ReturnRowView | null {
  if (!isShopReturnStatus(row.status)) return null;
  const line = detail.lines.find((candidate) => candidate.orderLineId === row.orderLineId);
  const outcome =
    row.disposition && isShopReturnDisposition(row.disposition) ? OUTCOME[row.disposition] : null;
  return {
    returnId: row.returnId,
    item: line ? orderLineLabel(line) : "Item",
    status: row.status,
    statusLabel: staffStatus("return", row.status),
    step: returnStepIndex(row.status),
    action: returnAction(row.status),
    outcome,
    context: row.receivedAt
      ? `Requested ${formatStaffDate(row.createdAt)} · received ${formatStaffDateTime(row.receivedAt)}`
      : `Requested ${formatStaffDate(row.createdAt)}`,
  };
}

/** The order's returns, newest first, as the Returns panel shows them. */
export function orderReturnRows(detail: AdminOrderDetail): ReturnRowView[] {
  return (detail.returns ?? []).flatMap((row) => {
    const view = viewOf(detail, row);
    return view ? [view] : [];
  });
}

/**
 * Where a cancelled line's print stands, shown beside its cancellation: back on sale straight
 * away (it never left the gallery), on its way back, or what staff decided when it arrived.
 */
export function cancelledLineStock(
  detail: AdminOrderDetail,
  orderLineId: string,
): StatusPresentation | null {
  const row = (detail.returns ?? []).find((candidate) => candidate.orderLineId === orderLineId);
  if (!row) return { label: "Back on sale", tone: "success" };
  if (row.disposition && isShopReturnDisposition(row.disposition)) return OUTCOME[row.disposition];
  return { label: "Awaiting return", tone: "info" };
}
