import type { AdminDeliveryRecord, IAdminDeliveriesReader } from "@auction/persistence/interfaces";
import { type AdminDeliveriesListQuery, majorToMinor } from "@auction/validators";
import type {
  AdminDeliveriesPage,
  AdminDeliveryEvent,
  AdminDeliveryView,
  IAdminDeliveriesService,
} from "../interfaces/admin-deliveries-service.js";

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

/** The sale filter lists the sales with a delivery asked for in this window, at most this many. */
export const DELIVERY_SALES_WINDOW_DAYS = 365;
export const DELIVERY_SALES_LIMIT = 100;

/**
 * What happened to a delivery, from the stamps the quote and fulfilment record keep: asked,
 * priced, accepted or withdrawn, then how it ended or where it is. A re-quote keeps only its
 * latest time (the quote holds one), which is enough for the first release (D7). Dispatch,
 * delivery and cancellation record no time of their own, so they carry none rather than the
 * fulfilment's last edit.
 */
export function deliveryHistory(record: AdminDeliveryRecord): AdminDeliveryEvent[] {
  const { quote, fulfilment } = record;
  const events: AdminDeliveryEvent[] = [
    { kind: "requested", at: quote.requestedAt.toISOString(), by: "buyer" },
  ];
  if (quote.quotedAt)
    events.push({ kind: "quoted", at: quote.quotedAt.toISOString(), by: "staff" });
  if (quote.decidedAt && (quote.status === "accepted" || quote.status === "withdrawn")) {
    events.push({ kind: quote.status, at: quote.decidedAt.toISOString(), by: "buyer" });
  }
  if (record.closedReason === "cancelled") {
    events.push({ kind: "cancelled", at: null, by: "staff" });
  } else if (record.closedReason === "collected") {
    events.push({ kind: "collected", at: iso(fulfilment?.collectedAt ?? null), by: "buyer" });
  } else if (record.status === "on_the_way") {
    events.push({ kind: "dispatched", at: null, by: "staff" });
  } else if (record.status === "delivered") {
    events.push({ kind: "delivered", at: null, by: "staff" });
  }
  // Dated steps oldest first; a step with no recorded time stays after them, in its place.
  const dated = events.filter((event) => event.at !== null);
  const undated = events.filter((event) => event.at === null);
  dated.sort((a, b) => (a.at as string).localeCompare(b.at as string));
  return [...dated, ...undated];
}

export function toDeliveryView(record: AdminDeliveryRecord): AdminDeliveryView {
  const { quote, lot, sale, buyer, fulfilment } = record;
  return {
    lotId: record.lotId,
    quoteId: record.quoteId,
    status: record.status,
    closedReason: record.closedReason,
    awaitingPayment: record.awaitingPayment,
    statusSince: iso(record.statusSince),
    destination: quote.destination,
    quote: {
      status: quote.status,
      amountMinor: quote.amount === null ? null : majorToMinor(quote.amount),
      currency: quote.currency,
      note: quote.note,
      requestedAt: quote.requestedAt.toISOString(),
      quotedAt: iso(quote.quotedAt),
      decidedAt: iso(quote.decidedAt),
    },
    lot: {
      title: lot.title,
      lotNumber: lot.lotNumber,
      imageUrl: lot.imageUrl,
      dimensions: lot.dimensions,
      hammerMinor: majorToMinor(lot.hammerPrice),
    },
    sale: sale ? { id: sale.id, title: sale.title, endsAt: sale.endsAt.toISOString() } : null,
    buyer,
    fulfilment: fulfilment
      ? {
          status: fulfilment.status,
          method: fulfilment.method,
          carrier: fulfilment.carrier,
          trackingNumber: fulfilment.trackingNumber,
          paidAt: iso(fulfilment.paidAt),
          collectedAt: iso(fulfilment.collectedAt),
        }
      : null,
    history: deliveryHistory(record),
  };
}

/** The staff Deliveries screen's reads: a view of the list with its counts, the badge, one lot. */
export class AdminDeliveriesService implements IAdminDeliveriesService {
  constructor(
    private readonly reader: IAdminDeliveriesReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(query: AdminDeliveriesListQuery): Promise<AdminDeliveriesPage> {
    const filters = {
      ...(query.q ? { search: query.q } : {}),
      ...(query.saleId ? { saleId: query.saleId } : {}),
    };
    const [page, counts, sales] = await Promise.all([
      this.reader.list({
        ...filters,
        status: query.view,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      }),
      this.reader.counts(filters),
      this.reader.sales({
        since: new Date(this.clock().getTime() - DELIVERY_SALES_WINDOW_DAYS * 86_400_000),
        limit: DELIVERY_SALES_LIMIT,
      }),
    ]);
    return {
      items: page.rows.map(toDeliveryView),
      total: page.total,
      offset: query.offset,
      limit: query.limit,
      counts,
      sales,
    };
  }

  /** Read on every staff page through the nav count, so it counts the waiting quotes alone. */
  async summary(): Promise<{ waitingCount: number }> {
    return { waitingCount: await this.reader.waitingCount() };
  }

  async detail(lotId: string): Promise<AdminDeliveryView | null> {
    const record = await this.reader.findByLotId(lotId);
    return record ? toDeliveryView(record) : null;
  }
}
