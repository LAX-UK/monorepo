import { type Result, err, ok } from "neverthrow";
import type {
  ILotFulfilmentBuyerService,
  LotFulfilmentRow,
  LotFulfilmentServiceError,
} from "../interfaces/lot-fulfilment-service.js";
import type { LotFulfilmentContext } from "./lot-fulfilment-context.js";

export class LotFulfilmentBuyerService implements ILotFulfilmentBuyerService {
  constructor(private readonly ctx: LotFulfilmentContext) {}

  async getForWinner(
    userId: string,
    lotId: string,
  ): Promise<Result<LotFulfilmentRow | null, LotFulfilmentServiceError>> {
    const lotRow = await this.ctx.lotRepo.findById(lotId);
    if (!lotRow) return err({ message: "Lot not found", status: 404 });
    if (lotRow.winnerId !== userId) {
      return err({
        message: "Only the winning bidder can view fulfilment for this lot",
        status: 403,
      });
    }
    const row = await this.ctx.fulfilmentRepo.findByLotId(lotId);
    return ok(row ?? null);
  }
}
