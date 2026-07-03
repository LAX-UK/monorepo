import { type Result, err, ok } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import type { IAmlHoldStore } from "../aml/ports.js";

export interface IAmlBidGate {
  assertCanBid(userId: string): Promise<Result<void, BidError>>;
}

export class AmlBidGate implements IAmlBidGate {
  constructor(private readonly amlHoldStore: IAmlHoldStore) {}

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

/** Null Object for absent AML hold store — always permits bidding. */
export class NoOpAmlBidGate implements IAmlBidGate {
  async assertCanBid(): Promise<Result<void, BidError>> {
    return ok(undefined);
  }
}
