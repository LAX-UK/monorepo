import type { AdminDeliveryRecord, IAdminDeliveriesReader } from "@auction/persistence/interfaces";
import { type AdminDeliveriesListQuery, majorToMinor } from "@auction/validators";
import type {
  AdminDeliveriesPage,
  AdminDeliveryEvent,
  AdminDeliveryView,
  IAdminDeliveriesService,
} from "../interfaces/admin-deliveries-service.js";

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

/**
 * What happened to a delivery, from the stamps the quote and fulfilment record keep: asked,
 * priced, accepted or withdrawn, then the fulfilment's last move. A re-quote keeps only its
 * latest time (the quote holds one), which is enough for the first release (D7).
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
  if (fulfilment && quote.status !== "withdrawn") {
    const moved = {
      in_transit: "dispatched",
      delivered: "delivered",
      cancelled: "cancelled",
    } as const;
    const kind = moved[fulfilment.status as keyof typeof moved];
    if (kind) events.push({ kind, at: fulfilment.updatedAt.toISOString(), by: "staff" });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

export function toDeliveryView(record: AdminDeliveryRecord): AdminDeliveryView {
  const { quote, lot, sale, buyer, fulfilment } = record;
  return {
    lotId: record.lotId,
    quoteId: record.quoteId,
    status: record.status,
    closedReason: record.closedReason,
    awaitingPayment: record.awaitingPayment,
    statusSince: record.statusSince.toISOString(),
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
          updatedAt: fulfilment.updatedAt.toISOString(),
        }
      : null,
    history: deliveryHistory(record),
  };
}

/** The staff Deliveries screen's reads: a view of the list with its counts, the badge, one lot. */
export class AdminDeliveriesService implements IAdminDeliveriesService {
  constructor(private readonly reader: IAdminDeliveriesReader) {}

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
      this.reader.sales(),
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

  async summary(): Promise<{ waitingCount: number }> {
    const counts = await this.reader.counts({});
    return { waitingCount: counts.waiting };
  }

  async detail(lotId: string): Promise<AdminDeliveryView | null> {
    const record = await this.reader.findByLotId(lotId);
    return record ? toDeliveryView(record) : null;
  }
}
