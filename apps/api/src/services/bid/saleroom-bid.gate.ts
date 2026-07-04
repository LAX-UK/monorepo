import type { Database } from "@auction/db";
import type { ISaleroomSessionLookup } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import type { SaleroomOnBlockPolicy } from "./saleroom-on-block.policy.js";

export class SaleroomBidGate {
  constructor(
    private readonly saleroomSessionLookup: ISaleroomSessionLookup | null,
    private readonly onBlockPolicy: SaleroomOnBlockPolicy | null,
  ) {}

  async assertCanBidOnLot(params: {
    lotId: string;
    saleId: string | null;
    tx: Database;
  }): Promise<Result<void, BidError>> {
    if (!this.saleroomSessionLookup || !this.onBlockPolicy) {
      return ok(undefined);
    }

    const enforceOnBlock = await this.saleroomSessionLookup.shouldEnforceOnBlockGateForLot(
      params.lotId,
    );
    if (!enforceOnBlock) {
      return ok(undefined);
    }

    if (!params.saleId) {
      return err(
        new BidError(
          "Saleroom is not live — bids can only be placed on the current lot",
          400,
          "lot_not_on_block",
        ),
      );
    }

    return this.onBlockPolicy.assertLotOnBlock(params.saleId, params.lotId, params.tx);
  }
}
