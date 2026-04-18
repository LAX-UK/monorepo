import type { Lot } from "@auction/types";
import type { ILotStrategy, ILotStrategyFactory } from "../services/interfaces/auction-strategy.js";
import { BuyItNowAuctionStrategy } from "./buy-it-now.strategy.js";
import { DutchAuctionStrategy } from "./dutch.strategy.js";
import { EnglishAuctionStrategy } from "./english.strategy.js";
import { SealedBidAuctionStrategy } from "./sealed-bid.strategy.js";

export class LotStrategyFactory implements ILotStrategyFactory {
  private readonly english = new EnglishAuctionStrategy();
  private readonly dutch = new DutchAuctionStrategy();
  private readonly sealed = new SealedBidAuctionStrategy();
  private readonly buyItNow = new BuyItNowAuctionStrategy();

  create(type: Lot["auctionType"]): ILotStrategy {
    switch (type) {
      case "english":
        return this.english;
      case "dutch":
        return this.dutch;
      case "sealed":
        return this.sealed;
      case "buy_it_now":
        return this.buyItNow;
      default: {
        const _exhaustive: never = type;
        return _exhaustive;
      }
    }
  }
}
