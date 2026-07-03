import type { ISaleroomDisplayControlService } from "../interfaces/saleroom-service.js";
import type { SaleroomSessionContext } from "./saleroom-session-context.js";

export class SaleroomDisplayControlService implements ISaleroomDisplayControlService {
  constructor(private readonly ctx: SaleroomSessionContext) {}

  async publishClerkPaddleBidSummary(input: {
    saleId: string;
    lotId: string;
    currentPrice: string;
    bidCount: number;
    leaderPaddleNumber: number | null;
  }): Promise<void> {
    if (!this.ctx.displayPublisher) return;
    await this.ctx.displayPublisher.publishDisplayControl(input.saleId, {
      kind: "bid_summary",
      lotId: input.lotId,
      currentPrice: input.currentPrice,
      bidCount: input.bidCount,
      leaderPaddleNumber: input.leaderPaddleNumber,
      emittedAt: new Date().toISOString(),
    });
  }

  async clearDisplayOverlayIfAny(saleId: string): Promise<void> {
    const { cleared } = await this.ctx.sessionRepo.clearDisplayOverlay(saleId);
    if (cleared && this.ctx.displayPublisher) {
      await this.ctx.displayPublisher.publishDisplayControl(saleId, {
        kind: "clear",
        emittedAt: new Date().toISOString(),
      });
    }
  }
}
