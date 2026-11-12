import type { BudgetDecision, CallBudget, Clock } from "./ports.js";

/**
 * A per-process daily budget, counted by UTC day. It is a safety stop, not the shared ledger: the
 * runtime that wires several processes together supplies a `CallBudget` backed by shared storage.
 */
export class InMemoryCallBudget implements CallBudget {
  private day = "";
  private readonly used = new Map<string, number>();

  constructor(
    private readonly clock: Clock,
    private readonly limit: number,
  ) {}

  consume(organizationId: string): Promise<BudgetDecision> {
    const today = new Date(this.clock.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used.clear();
    }
    const used = this.used.get(organizationId) ?? 0;
    if (used >= this.limit) return Promise.resolve({ allowed: false, used, limit: this.limit });
    this.used.set(organizationId, used + 1);
    return Promise.resolve({ allowed: true, used: used + 1, limit: this.limit });
  }
}
