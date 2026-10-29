import { type Result, err, ok } from "neverthrow";
import type { PaymentAuthorityLot } from "../interfaces/buyer-payment-authority.js";
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
    if (!(await this.mayFollow(userId, lotRow))) {
      return err({
        message: "Only the winner or the account's payers can view fulfilment for this lot",
        status: 403,
      });
    }
    const row = await this.ctx.fulfilmentRepo.findByLotId(lotId);
    return ok(row ?? null);
  }

  /** The winner follows their lot; so do the people who pay for it (an organisation's payers). */
  private async mayFollow(userId: string, lot: PaymentAuthorityLot): Promise<boolean> {
    if (lot.winnerId === userId) return true;
    if (!this.ctx.paymentAuthority) return false;
    return (await this.ctx.paymentAuthority.canPay({ userId }, lot)).allowed;
  }
}
