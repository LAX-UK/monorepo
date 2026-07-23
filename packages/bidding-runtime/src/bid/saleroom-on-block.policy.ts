import type { Database } from "@auction/db";
import type { ISaleroomOnBlockReader } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";

export class SaleroomOnBlockPolicy {
  constructor(private readonly reader: ISaleroomOnBlockReader) {}

  async assertLotOnBlock(
    saleId: string,
    lotId: string,
    tx?: Database,
  ): Promise<Result<void, BidError>> {
    const session = await (tx ? this.reader.forConnection(tx) : this.reader).getSessionState(
      saleId,
    );

    if (session?.status === "paused") {
      return err(
        new BidError("Saleroom is paused — bidding will resume shortly", 400, "saleroom_paused"),
      );
    }
    if (!session || session.status !== "live") {
      return err(
        new BidError(
          "Saleroom is not live — bids can only be placed on the current lot",
          400,
          "lot_not_on_block",
        ),
      );
    }
    if (session.currentLotId !== lotId) {
      return err(new BidError("This lot is not on the block", 400, "lot_not_on_block"));
    }
    return ok(undefined);
  }
}
