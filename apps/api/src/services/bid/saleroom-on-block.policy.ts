import type { Database } from "@auction/db";
import { saleroomSession } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../../lib/errors.js";

export class SaleroomOnBlockPolicy {
  constructor(private readonly db: Database) {}

  async assertLotOnBlock(saleId: string, lotId: string): Promise<Result<void, BidError>> {
    const [session] = await this.db
      .select({
        status: saleroomSession.status,
        currentLotId: saleroomSession.currentLotId,
      })
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);

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
