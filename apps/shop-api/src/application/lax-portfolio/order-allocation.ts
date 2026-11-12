/**
 * How one order's money is spread over its work lines, so that Portfolio (per work) and Money
 * (per order) state the same figures. Pure integer pence, no I/O.
 *
 * An order is charged `totalPence`: its work lines, its delivery charge, and anything else the
 * order carries (framing). A person's portfolio only shows some of those lines, so the shares
 * below always add back up to the order: what no shown line carries is handed to one carrier line
 * rather than dropped.
 */
export type OrderLine = {
  id: string;
  pricePence: number;
  /** Whether the work stays in the portfolio; a released or resold work does not. */
  held: boolean;
};

export type OrderRefund = {
  /** The line the refund was made against, or null when it was made against the whole order. */
  lineId: string | null;
  amountPence: number;
};

export type LineShare = {
  id: string;
  /** The line's price as charged, plus any charge no shown line carries when it is the carrier. */
  pricePence: number;
  /** The delivery charge, on the carrier line only. */
  shippingPence: number;
  /** What was handed back against this line, never more than it was charged. */
  refundedPence: number;
};

export type OrderToAllocate = {
  /** What the order was charged; null when unknown, which makes it the sum of its parts. */
  totalPence: number | null;
  shippingPence: number;
  lines: readonly OrderLine[];
  refunds: readonly OrderRefund[];
};

/**
 * - Delivery and every other charge the lines do not cover go on the carrier: the first work
 *   still held, else the first line. Delivery therefore survives whichever line is released.
 * - A refund made against a line comes off that line first. One made against the whole order, or
 *   what exceeds its line, comes off released works before held ones, then in line order.
 */
export function allocateOrder(order: OrderToAllocate): LineShare[] {
  const { lines } = order;
  if (lines.length === 0) return [];
  const goods = lines.reduce((sum, line) => sum + line.pricePence, 0);
  const total = order.totalPence ?? goods + order.shippingPence;
  const uncovered = Math.max(0, total - goods);
  const shipping = Math.min(order.shippingPence, uncovered);
  const carrier = Math.max(
    0,
    lines.findIndex((line) => line.held),
  );

  const shares: LineShare[] = lines.map((line, index) => ({
    id: line.id,
    pricePence: line.pricePence + (index === carrier ? uncovered - shipping : 0),
    shippingPence: index === carrier ? shipping : 0,
    refundedPence: 0,
  }));
  const room = (share: LineShare) => share.pricePence + share.shippingPence - share.refundedPence;
  const take = (share: LineShare, amount: number): number => {
    const taken = Math.min(amount, room(share));
    share.refundedPence += taken;
    return amount - taken;
  };

  let wholeOrder = 0;
  for (const refund of order.refunds) {
    const share = shares.find((candidate) => candidate.id === refund.lineId);
    wholeOrder += share ? take(share, refund.amountPence) : refund.amountPence;
  }
  const releasedFirst = [
    ...shares.filter((_, index) => !lines[index]?.held),
    ...shares.filter((_, index) => lines[index]?.held),
  ];
  for (const share of releasedFirst) wholeOrder = take(share, wholeOrder);
  return shares;
}

export type AllocationLine = OrderLine & { orderId: string };

/** Allocates every order that has lines, returning the share of each line by its id. */
export function allocateOrders(input: {
  lines: readonly AllocationLine[];
  orders: ReadonlyMap<string, { totalPence: number; shippingPence: number }>;
  refunds: ReadonlyMap<string, readonly OrderRefund[]>;
}): Map<string, LineShare> {
  const byOrder = new Map<string, AllocationLine[]>();
  for (const line of input.lines) {
    byOrder.set(line.orderId, [...(byOrder.get(line.orderId) ?? []), line]);
  }
  const shares = new Map<string, LineShare>();
  for (const [orderId, lines] of byOrder) {
    const facts = input.orders.get(orderId);
    const allocated = allocateOrder({
      totalPence: facts?.totalPence ?? null,
      shippingPence: facts?.shippingPence ?? 0,
      lines,
      refunds: input.refunds.get(orderId) ?? [],
    });
    for (const share of allocated) shares.set(share.id, share);
  }
  return shares;
}
