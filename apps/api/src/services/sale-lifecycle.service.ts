import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";

/**
 * Keeps umbrella `sale` rows aligned with child lots (no per-lot Bull jobs on the sale).
 */
export class SaleLifecycleService {
  constructor(
    private readonly sales: ISaleRepository,
    private readonly lots: ILotRepository,
  ) {}

  /** Call after `LotLifecycleService.runTransitions` (or on a timer). */
  async reconcileSaleStatuses(): Promise<void> {
    const candidates = await this.sales.findWithStatuses(["scheduled", "active"]);
    for (const s of candidates) {
      const childLots = await this.lots.findBySaleId(s.id);
      if (childLots.length === 0) continue;

      const allTerminal = childLots.every((l) => l.status === "ended" || l.status === "cancelled");
      if (allTerminal && s.status !== "ended") {
        await this.sales.updateStatus(s.id, "ended");
        continue;
      }

      const anyActive = childLots.some((l) => l.status === "active");
      if (anyActive && s.status === "scheduled") {
        await this.sales.updateStatus(s.id, "active");
      }
    }
  }
}
