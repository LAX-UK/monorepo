import type { ILotRepository, ISaleRepository } from "@auction/persistence";
import type { Lot } from "@auction/types";

/** Keeps umbrella `sale` rows aligned with child lots (no per-lot Bull jobs on the sale).
 */
export class SaleLifecycleService {
  constructor(
    private readonly sales: ISaleRepository,
    private readonly lots: ILotRepository,
  ) {}

  /** Call after `LotLifecycleService.runTransitions` (or on a timer). */
  async reconcileSaleStatuses(): Promise<void> {
    const candidates = await this.sales.findWithStatuses(["scheduled", "active"]);
    if (candidates.length === 0) return;
    const allLots = await this.lots.findBySaleIds(candidates.map((s) => s.id));
    const bySale = new Map<string, Lot[]>();
    for (const l of allLots) {
      if (!l.saleId) continue;
      const arr = bySale.get(l.saleId) ?? [];
      arr.push(l);
      bySale.set(l.saleId, arr);
    }
    for (const s of candidates) {
      const childLots = bySale.get(s.id) ?? [];
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
