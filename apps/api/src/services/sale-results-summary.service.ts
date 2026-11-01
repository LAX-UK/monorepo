import {
  type SaleResultLot,
  type SaleResultsSummary,
  minorUnitsToMoneyString,
  parseMoneyToMinorUnits,
  saleHasResultsPhase,
  summariseSaleResults,
} from "@auction/domain";
import type {
  ISaleChannelReader,
  ISaleResultLotsReader,
  SaleResultLotRow,
} from "@auction/persistence/interfaces";
import type { Sale } from "@auction/types";
import { buildBuyerPremiumPolicy } from "@auction/validators";

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

function withPremiumFor(sale: Sale) {
  return (lot: SaleResultLot & { premiumRate: string }): string => {
    const policy = buildBuyerPremiumPolicy({
      saleTiers: sale.buyerPremiumTiers ?? null,
      lotRate: lot.premiumRate,
    });
    const hammer = parseMoneyToMinorUnits(lot.currentPrice);
    const premium = parseMoneyToMinorUnits(policy.computePremiumMajor(lot.currentPrice));
    return minorUnitsToMoneyString(hammer + premium);
  };
}

function toResultLot(
  row: SaleResultLotRow,
  external: boolean,
  soldExternally: ReadonlySet<string>,
): SaleResultLot & { premiumRate: string } {
  return {
    id: row.id,
    status: row.status,
    currentPrice: row.currentPrice,
    hasWinner: row.hasWinner,
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
    private readonly now: () => Date = () => new Date(),
  ) {}

  async summarise(sales: readonly Sale[]): Promise<Map<string, SaleResultsSummary>> {
    const due = sales.filter((s) =>
      saleHasResultsPhase({ status: s.status, externalState: externalState(s) }),
    );
    const out = new Map<string, SaleResultsSummary>();
    if (due.length === 0) return out;

    const rowsBySale = await this.lots.listBySaleIds(due.map((s) => s.id));
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
          withPremium: withPremiumFor(sale),
        });
        if (summary) out.set(sale.id, summary);
      }),
    );
    return out;
  }
}
