import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import type { IAmlHoldReader } from "../ports.js";

export interface IAmlBidGate {
  assertCanBid(userId: string): Promise<Result<void, BidError>>;
}

export class AmlBidGate implements IAmlBidGate {
  constructor(private readonly amlHoldStore: IAmlHoldReader) {}

  async assertCanBid(userId: string): Promise<Result<void, BidError>> {
    const hold = await this.amlHoldStore.getHold(userId);
    if (hold?.status === "blocked") {
      return err(
        new BidError("Bidding is suspended pending compliance review", 403, "aml_blocked"),
      );
    }
    return ok(undefined);
  }
}

export class NoOpAmlBidGate implements IAmlBidGate {
  async assertCanBid(): Promise<Result<void, BidError>> {
    return ok(undefined);
  }
}
