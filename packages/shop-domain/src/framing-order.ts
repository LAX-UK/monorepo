import { type VatPolicy, computeLineVat } from "./vat-policy.js";

/**
 * Framing in an order. A framed print is two order lines: the print, and a framing line that
 * points at it. The framing line is priced, taxed and refunded as its own line, at the standard
 * rate, and is never part of what the artist or owner is paid: it has no edition and no seller.
 */

export const ORDER_LINE_KINDS = ["goods", "framing"] as const;
export type OrderLineKind = (typeof ORDER_LINE_KINDS)[number];

/** What the buyer was sold, kept as it was at checkout so a later catalogue change never alters it. */
export type FramingOrderSnapshot = {
  optionId: string;
  name: string;
  frame: string;
  mount: string;
  glazing: string;
  hanging: string;
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
  /** Pence including VAT, for one print. */
  pricePence: number;
};

/** The VAT a framing line carries: the standard rate, whatever the print is sold under. */
export function framingLineVat(policy: VatPolicy | null, pricePence: number) {
  return computeLineVat(policy, { unitPricePence: pricePence });
}

/** Work on the frame for one print, from queued to finished. */
export const FRAMING_TASK_STATUSES = [
  "queued",
  "framing",
  "framed",
  "completed",
  "cancelled",
] as const;
export type FramingTaskStatus = (typeof FRAMING_TASK_STATUSES)[number];

const NEXT_STEPS: Record<FramingTaskStatus, readonly FramingTaskStatus[]> = {
  queued: ["framing", "cancelled"],
  framing: ["framed", "cancelled"],
  framed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function framingTaskNextSteps(status: FramingTaskStatus): readonly FramingTaskStatus[] {
  return NEXT_STEPS[status];
}

export function canMoveFramingTask(from: FramingTaskStatus, to: FramingTaskStatus): boolean {
  return NEXT_STEPS[from].includes(to);
}

/** Framing is done with, either way: nothing more to wait for. */
export function framingTaskFinished(status: FramingTaskStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/** The frame is being made or made: the work cannot be taken back as if it never happened. */
export function framingTaskStarted(status: FramingTaskStatus): boolean {
  return status !== "queued" && status !== "cancelled";
}

export type FramingRefundBlock = "production_started";

/**
 * Whether a framing line can be refunded on its own. Once the frame is being made it goes back
 * with the print or not at all, so the work is not refunded away from under the framer.
 */
export function framingRefundBlock(
  taskStatus: FramingTaskStatus | null,
): FramingRefundBlock | null {
  return taskStatus !== null && framingTaskStarted(taskStatus) ? "production_started" : null;
}

/** The date `days` working days (Monday to Friday) after `from`, in UTC. Bank holidays are not known. */
export function addWorkingDaysUtc(from: Date, days: number): Date {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return date;
}

/**
 * When the frame is due: the option's longest lead time, in working days, after the order was
 * paid. The lead time comes from the snapshot, so a later catalogue change moves nothing.
 */
export function framingDueAt(
  paidAt: Date,
  snapshot: Pick<FramingOrderSnapshot, "leadTimeMaxDays">,
) {
  return addWorkingDaysUtc(paidAt, snapshot.leadTimeMaxDays);
}
