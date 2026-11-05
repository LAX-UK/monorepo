import type { RecordMatchService } from "@auction/alerts";
import type {
  IBidAlertSaleNoticeWriter,
  IBidAlertSaleReader,
} from "@auction/persistence/interfaces";
import type { SalePublishedEvent } from "../projectors/lib/bid-alert-matching.types.js";
import { saleNotice, saleSnapshot } from "./sale-snapshot.js";

export type SaleAnnounceOutcome =
  | "announced"
  | "skipped_not_published"
  | "skipped_test_sale"
  | "already_announced"
  | "quiet";

/**
 * New-sale matcher (a test sale is never announced): when a sale is published, every subscriber with new-sale email on gets one
 * match in the ledger and every signed-in subscriber one in-app notice. It writes no email; the
 * 08:00 digest does. A sale unpublished again before this ran is left unclaimed, so announcing
 * it when it is published for good still works.
 */
export class BidSaleAnnouncer {
  constructor(
    private readonly deps: {
      sales: Pick<IBidAlertSaleReader, "find">;
      matches: Pick<RecordMatchService, "announce">;
      notices: Pick<IBidAlertSaleNoticeWriter, "notifySubscribers">;
      /** In a dry run matches are recorded and nobody is told in the app. */
      sendNotices: boolean;
    },
  ) {}

  async handle(event: SalePublishedEvent): Promise<SaleAnnounceOutcome> {
    const sale = await this.deps.sales.find(event.saleId);
    if (!sale || (sale.status !== "scheduled" && sale.status !== "active")) {
      return "skipped_not_published";
    }
    if (sale.isTest) return "skipped_test_sale";
    const result = await this.deps.matches.announce({
      topic: "bid.new_sales",
      itemKey: `sale:${sale.id}`,
      snapshot: saleSnapshot(sale, event.lotCount),
      announce: event.announce,
    });
    if (!result.announced) return result.first ? "quiet" : "already_announced";
    if (this.deps.sendNotices) {
      await this.deps.notices.notifySubscribers(saleNotice(sale, event.lotCount));
    }
    return "announced";
  }
}
