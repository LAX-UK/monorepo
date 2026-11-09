import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopFramingTask,
  shopOrder,
  shopOrderLine,
  shopRefund,
} from "@auction/db/schema";
import type { AdminFramingDueList } from "@auction/shop-contracts";
import {
  FRAMING_FRAME_LABELS,
  FRAMING_GLAZING_LABELS,
  FRAMING_HANGING_LABELS,
  FRAMING_MOUNT_LABELS,
  type FramingFrame,
  type FramingGlazing,
  type FramingHanging,
  type FramingMount,
  type FramingOrderSnapshot,
  parseFramingOrderSnapshot,
  parseFramingTaskStatus,
} from "@auction/shop-domain";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

/** What a frame is made of, as sold: "Natural oak, 20 mm · Window mount, ... · UV-filtering acrylic · D-rings and cord". */
export function describeFramingSpec(
  snapshot: Pick<FramingOrderSnapshot, "frame" | "mount" | "glazing" | "hanging">,
): string {
  return [
    FRAMING_FRAME_LABELS[snapshot.frame as FramingFrame],
    FRAMING_MOUNT_LABELS[snapshot.mount as FramingMount],
    FRAMING_GLAZING_LABELS[snapshot.glazing as FramingGlazing],
    FRAMING_HANGING_LABELS[snapshot.hanging as FramingHanging],
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The most frames the list shows at once; the work in hand is far fewer. */
const FRAMING_DUE_LIMIT = 200;

const OPEN_STATUSES = ["queued", "framing", "framed"];

/**
 * The frames still to make or finish, soonest due first, with what each is (the option's spec as
 * sold) and the print it goes with. Only frames on paid orders and not refunded appear: a refunded
 * frame has nothing to make.
 */
export async function listFramingDue(db: Database): Promise<AdminFramingDueList> {
  const print = alias(shopOrderLine, "print");
  const rows = await db
    .select({
      taskId: shopFramingTask.id,
      status: shopFramingTask.status,
      dueAt: shopFramingTask.dueAt,
      version: shopFramingTask.version,
      frameLineId: shopOrderLine.id,
      framePence: shopOrderLine.unitPricePence,
      snapshot: shopOrderLine.framingSnapshot,
      orderId: shopOrder.id,
      orderReference: shopOrder.reference,
      printTitle: shopArtwork.title,
      editionNumber: print.editionNumber,
    })
    .from(shopFramingTask)
    .innerJoin(shopOrderLine, eq(shopFramingTask.orderLineId, shopOrderLine.id))
    .innerJoin(shopOrder, eq(shopOrderLine.orderId, shopOrder.id))
    .innerJoin(print, eq(shopOrderLine.framingForLineId, print.id))
    .leftJoin(shopArtwork, eq(print.artworkId, shopArtwork.id))
    .where(
      and(
        inArray(shopFramingTask.status, OPEN_STATUSES),
        inArray(shopOrder.status, ["paid", "partially_refunded"]),
      ),
    )
    .orderBy(asc(shopFramingTask.dueAt), asc(shopFramingTask.id))
    .limit(FRAMING_DUE_LIMIT);
  if (rows.length === 0) return { items: [] };

  const refunds = await db
    .select({ orderLineId: shopRefund.orderLineId, amountPence: shopRefund.amountPence })
    .from(shopRefund)
    .where(
      and(
        inArray(
          shopRefund.orderLineId,
          rows.map((row) => row.frameLineId),
        ),
        ne(shopRefund.status, "failed"),
        ne(shopRefund.status, "cancelled"),
      ),
    );
  const refundedByLine = new Map<string, number>();
  for (const refund of refunds) {
    if (!refund.orderLineId) continue;
    refundedByLine.set(
      refund.orderLineId,
      (refundedByLine.get(refund.orderLineId) ?? 0) + refund.amountPence,
    );
  }

  return {
    items: rows
      .filter((row) => (refundedByLine.get(row.frameLineId) ?? 0) < row.framePence)
      .map((row) => {
        const snapshot = parseFramingOrderSnapshot(row.snapshot);
        return {
          taskId: row.taskId,
          status: parseFramingTaskStatus(row.status),
          dueAt: row.dueAt.toISOString(),
          version: row.version,
          orderId: row.orderId,
          orderReference: row.orderReference,
          printTitle: row.printTitle ?? "Print",
          editionNumber: row.editionNumber,
          name: snapshot.name,
          spec: describeFramingSpec(snapshot),
        };
      }),
  };
}
