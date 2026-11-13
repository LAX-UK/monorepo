import {
  type SaleResultLot,
  type SaleResultsSummary,
  minorUnitsToMoneyString,
  parseMoneyToMinorUnits,
  saleHasResultsPhase,
  summariseSaleResults,
} from "@auction/domain";
import type {
  IInvoicedSalePriceReader,
  ISaleChannelReader,
  ISaleResultLotsReader,
  InvoicedSalePrice,
  SaleResultLotRow,
} from "@auction/persistence/interfaces";
import type { Sale } from "@auction/types";
import { resolveBuyerPremium } from "@auction/validators";

/** What list and detail reads need to attach results to sales. */
export interface ISaleResultsSummaryService {
  /**
   * Results for the sales that have reached their results phase, keyed by sale id. Sales that
   * have not (or that have no external-state context) are absent, so callers pay nothing for them.
   * The sales must already carry `sellingPlatform` and `atgAuctionState`.
   */
  summarise(sales: readonly Sale[]): Promise<Map<string, SaleResultsSummary>>;
}

function externalState(sale: Sale): "live" | "ended" | null {
  return sale.sellingPlatform === "atg" ? (sale.atgAuctionState ?? null) : null;
}

/**
 * A sold lot's price with the premium: what its invoice charged once raised, else what the
 * resolver charges now.
 */
function withPremiumFor(sale: Sale, invoiced: ReadonlyMap<string, InvoicedSalePrice>) {
  return (lot: SaleResultLot & { premiumRate: string | null }): string => {
    const sold = invoiced.get(lot.id);
    if (sold) return minorUnitsToMoneyString(BigInt(sold.hammerPence + sold.premiumPence));
    const { policy } = resolveBuyerPremium({ lotRate: lot.premiumRate, sale });
    const hammer = parseMoneyToMinorUnits(lot.currentPrice);
    const premium = parseMoneyToMinorUnits(policy.computePremiumMajor(lot.currentPrice));
    return minorUnitsToMoneyString(hammer + premium);
  };
}

function toResultLot(
  row: SaleResultLotRow,
  external: boolean,
  soldExternally: ReadonlySet<string>,
): SaleResultLot & { premiumRate: string | null } {
  return {
    id: row.id,
    status: row.status,
    currentPrice: row.currentPrice,
    hasWinner: row.hasWinner,
    resultPending: row.resultPending,
    endTime: row.endTime,
    extendedUntil: row.extendedUntil,
    external,
    externalSold: external && soldExternally.has(row.id),
    premiumRate: row.buyerPremiumRate,
  };
}

export class SaleResultsSummaryService implements ISaleResultsSummaryService {
  constructor(
    private readonly lots: ISaleResultLotsReader,
    private readonly channel: Pick<ISaleChannelReader, "getSoldLotIds"> | null,
    private readonly invoicedPrices: IInvoicedSalePriceReader | null = null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async summarise(sales: readonly Sale[]): Promise<Map<string, SaleResultsSummary>> {
    const due = sales.filter((s) =>
      saleHasResultsPhase({ status: s.status, externalState: externalState(s) }),
    );
    const out = new Map<string, SaleResultsSummary>();
    if (due.length === 0) return out;

    const rowsBySale = await this.lots.listBySaleIds(due.map((s) => s.id));
    const invoiced = await this.invoicedPricesOf([...rowsBySale.values()].flat());
    const now = this.now();
    await Promise.all(
      due.map(async (sale) => {
        const state = externalState(sale);
        const sold =
          state === "ended" && this.channel
            ? await this.channel.getSoldLotIds(sale.id)
            : new Set<string>();
        const lots = (rowsBySale.get(sale.id) ?? []).map((row) =>
          toResultLot(row, state !== null, sold),
        );
        const summary = summariseSaleResults({
          sale: {
            status: sale.status,
            endTime: sale.endTime,
            externalState: state,
            externalResultsLanded: sold.size > 0,
          },
          lots,
          now,
          withPremium: withPremiumFor(sale, invoiced),
        });
        if (summary) out.set(sale.id, summary);
      }),
    );
    return out;
  }

  /** The invoices of every sold lot across the sales, in one read. */
  private async invoicedPricesOf(rows: readonly SaleResultLotRow[]) {
    const sold = rows.filter((r) => r.status === "ended" && r.hasWinner && !r.resultPending);
    if (!this.invoicedPrices || sold.length === 0) return new Map<string, InvoicedSalePrice>();
    return this.invoicedPrices.findInvoicedSalePrices(sold.map((r) => r.id));
  }
}
