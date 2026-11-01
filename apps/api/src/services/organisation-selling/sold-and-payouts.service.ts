import {
  type PayoutTotals,
  type SoldLotPayoutStage,
  entityActorCan,
  payoutLineBreakdown,
  payoutTotals,
  payoutTotalsDiffer,
  saleLineBreakdown,
  soldLotPayoutStage,
} from "@auction/domain";
import { type ExportColumn, formatCsvDocument } from "@auction/exports";
import type {
  IPayoutLinesReader,
  ISoldLotsReader,
  SoldLotRow,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  ISoldAndPayoutsService,
  PayoutDetailView,
  SellingResult,
  SoldLotView,
} from "../interfaces/organisation-selling-service.js";
import { entityActorOf, paged, sellingError } from "./selling-errors.js";

/** A payout whose stored totals disagree with its lines. */
export type PayoutTotalsMismatch = {
  payoutId: string;
  legalEntityId: string;
  stored: PayoutTotals;
  derived: PayoutTotals;
};

/** The most rows one export carries; a longer history is exported a year at a time. */
const EXPORT_LIMIT = 5000;

const STAGE_WORDS: Record<SoldLotPayoutStage, string> = {
  buyer_paying: "Buyer paying",
  paid_by_buyer: "Paid by buyer",
  in_payout: "In a payout",
  paid_out: "Paid out",
  payout_problem: "Payout delayed",
  refunded: "Refunded",
};

const SOLD_COLUMNS: ExportColumn[] = [
  { key: "lotNumber", header: "Lot" },
  { key: "title", header: "Title" },
  { key: "sale", header: "Sale" },
  { key: "soldOn", header: "Sold on" },
  { key: "hammer", header: "Hammer price" },
  { key: "net", header: "Net to you" },
  { key: "status", header: "Status" },
  { key: "paidOutOn", header: "Paid out on" },
];

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** The calendar year as a half-open range in UTC, for the year filter. */
function yearRange(year: number | undefined): { from?: Date; to?: Date } {
  if (year === undefined) return {};
  return { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 0, 1)) };
}

function soldView(row: SoldLotRow): SoldLotView {
  const stage = soldLotPayoutStage({
    paymentStatus: row.payment?.status ?? null,
    payoutStatus: row.payout?.status ?? null,
  });
  const paid = row.payment && row.payment.status === "captured";
  // The amount the sale settles: its payout line once it is on a payout, else the whole payment.
  const settled = row.payout?.lineAmount ?? row.payment?.amount ?? "0.00";
  return {
    lotId: row.lotId,
    lotTitle: row.lotTitle,
    lotNumber: row.lotNumber,
    saleTitle: row.saleTitle,
    soldAt: row.soldAt,
    hammerPrice: row.hammerPrice,
    stage,
    net:
      paid && row.payment
        ? saleLineBreakdown({
            lineAmount: settled,
            paymentAmount: row.payment.amount,
            platformFee: row.payment.platformFee,
          }).net
        : null,
    payout: row.payout ? { id: row.payout.id, settledAt: row.payout.settledAt } : null,
  };
}

/**
 * Sold & payouts: each sold lot with where its money stands, a payout's lines with the
 * commission and fees on each, and the sold lots as a CSV. Only the members who see the seller's
 * money (`entity.payouts.read`: owners, admins, finance) read any of it.
 */
export class SoldAndPayoutsService implements ISoldAndPayoutsService {
  constructor(
    private readonly deps: {
      sold: ISoldLotsReader;
      payouts: IPayoutLinesReader;
      /** Told when a payout's stored totals differ from its lines; the stored totals are shown. */
      onTotalsMismatch?: (report: PayoutTotalsMismatch) => void;
    },
  ) {}

  private canRead(actor: OrganisationMemberActor): boolean {
    return entityActorCan(entityActorOf(actor), "entity.payouts.read");
  }

  async listSold(
    actor: OrganisationMemberActor,
    page: { limit: number; offset: number; year?: number | undefined },
  ): SellingResult<{ items: SoldLotView[]; nextOffset: number | null }> {
    if (!this.canRead(actor)) return err(sellingError("insufficient_entity_role"));
    const rows = await this.deps.sold.list({
      legalEntityId: actor.legalEntityId,
      ...yearRange(page.year),
      limit: page.limit + 1,
      offset: page.offset,
    });
    return ok(paged(rows.map(soldView), page));
  }

  async exportSoldCsv(
    actor: OrganisationMemberActor,
    filter: { year?: number },
  ): SellingResult<string> {
    if (!this.canRead(actor)) return err(sellingError("insufficient_entity_role"));
    const rows = await this.deps.sold.list({
      legalEntityId: actor.legalEntityId,
      ...yearRange(filter.year),
      limit: EXPORT_LIMIT,
      offset: 0,
    });
    const lines = rows.map((row) => {
      const view = soldView(row);
      return {
        lotNumber: view.lotNumber ?? "",
        title: view.lotTitle,
        sale: view.saleTitle ?? "",
        soldOn: isoDay(view.soldAt),
        hammer: view.hammerPrice,
        net: view.net ?? "",
        status: STAGE_WORDS[view.stage],
        paidOutOn: view.stage === "paid_out" ? isoDay(view.payout?.settledAt ?? null) : "",
      };
    });
    return ok(formatCsvDocument(SOLD_COLUMNS, lines));
  }

  async payoutDetail(
    actor: OrganisationMemberActor,
    payoutId: string,
  ): SellingResult<PayoutDetailView> {
    if (!this.canRead(actor)) return err(sellingError("insufficient_entity_role"));
    const found = await this.deps.payouts.find(actor.legalEntityId, payoutId);
    if (!found) return err(sellingError("payout_not_found"));
    // The header is what is transferred. It must equal the lines added up; if it ever does not,
    // say so rather than quietly show a different figure.
    const derived = payoutTotals(found.lines, found.stripeFee);
    if (payoutTotalsDiffer(found, derived)) {
      this.deps.onTotalsMismatch?.({
        payoutId: found.id,
        legalEntityId: actor.legalEntityId,
        stored: {
          gross: found.grossAmount,
          platformFee: found.platformFee,
          stripeFee: found.stripeFee,
          net: found.netAmount,
        },
        derived,
      });
    }
    return ok({
      ...found,
      lines: found.lines.map((line) => ({
        id: line.id,
        kind: line.kind,
        note: line.note,
        lot: line.lot,
        amount: line.amount,
        breakdown: payoutLineBreakdown(line),
      })),
    });
  }
}
