import type { IBidAuthority, IBiddingLimitGate } from "@auction/bidding-runtime";
import {
  type LotViewerState,
  nextBidAmount,
  numberToMoneyString,
  purchaseInvoiceState,
  readLotViewerState,
} from "@auction/domain";
import type { ILotViewerFactsReader, LotViewerRawFacts } from "@auction/persistence/interfaces";
import { LOT_STATES_MAX_LOTS, memberRequiresWebSaleRegistration } from "@auction/validators";
import type {
  ILotViewerStateService,
  LotCardStateView,
  LotViewerActor,
  LotViewerPurchase,
  LotViewerView,
} from "../interfaces/lot-viewer-state.js";

export type LotViewerStateServiceDeps = {
  facts: ILotViewerFactsReader;
  bidAuthority: IBidAuthority;
  limitGate: Pick<IBiddingLimitGate, "room">;
  now?: () => Date;
};

/**
 * Where a person stands on lots, read through the one domain reader the lot page, the cards and
 * the phone bar share. The database is read once for any number of lots.
 */
export class LotViewerStateService implements ILotViewerStateService {
  private readonly now: () => Date;

  constructor(private readonly deps: LotViewerStateServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async forLot(input: { actor: LotViewerActor; lotId: string }): Promise<LotViewerView | null> {
    const [facts] = await this.deps.facts.load({
      lotIds: [input.lotId],
      userId: input.actor.userId,
      legalEntityId: input.actor.legalEntityId,
    });
    if (!facts) return null;
    const state = this.stateOf(facts);
    const registrationRequired =
      facts.saleId !== null && memberRequiresWebSaleRegistration(input.actor.memberRole);
    return {
      lotId: facts.lotId,
      registration: state.registration,
      registrationRequired,
      position: state.position,
      myHighestBid: state.myHighestBid,
      myMaxBid: state.myMaxBid,
      purchase: this.purchaseOf(facts),
      agentLimitLeft: registrationRequired ? await this.agentLimitLeft(input.actor, facts) : null,
    };
  }

  async forLots(input: {
    actor: LotViewerActor;
    lotIds: readonly string[];
  }): Promise<LotCardStateView[]> {
    const rows = await this.deps.facts.load({
      lotIds: input.lotIds.slice(0, LOT_STATES_MAX_LOTS),
      userId: input.actor.userId,
      legalEntityId: input.actor.legalEntityId,
    });
    const states: LotCardStateView[] = [];
    for (const facts of rows) {
      const { position } = this.stateOf(facts);
      // Only lots the viewer has bid on carry a line, so the grid stays quiet.
      if (position === "none") continue;
      states.push({
        lotId: facts.lotId,
        position,
        nextBidAmount:
          facts.lotStatus === "active" || facts.lotStatus === "scheduled"
            ? nextBidAmount(facts)
            : null,
      });
    }
    return states;
  }

  private stateOf(facts: LotViewerRawFacts): LotViewerState {
    return readLotViewerState({
      lotStatus: facts.lotStatus,
      currentPrice: facts.currentPrice,
      registration: facts.registration,
      leading: facts.leading,
      won: facts.won,
      hasBid: facts.hasBid,
      highestBid: facts.highestBid,
      maxBid: facts.maxBid,
    });
  }

  private purchaseOf(facts: LotViewerRawFacts): LotViewerPurchase | null {
    if (!facts.won || !facts.payment) return null;
    const state = purchaseInvoiceState({ payment: facts.payment }, this.now());
    return {
      id: facts.payment.id,
      status: state.status,
      dueAt: state.dueAt?.toISOString() ?? null,
    };
  }

  private async agentLimitLeft(
    actor: LotViewerActor,
    facts: LotViewerRawFacts,
  ): Promise<string | null> {
    const authority = await this.deps.bidAuthority.resolve({
      userId: actor.userId,
      legalEntityId: actor.legalEntityId,
      saleId: facts.saleId,
    });
    const binding = await this.deps.limitGate.room({
      legalEntityId: actor.legalEntityId,
      placedByUserId: actor.userId,
      lotId: facts.lotId,
      saleId: facts.saleId,
      authority,
    });
    return binding ? numberToMoneyString(binding.available) : null;
  }
}
