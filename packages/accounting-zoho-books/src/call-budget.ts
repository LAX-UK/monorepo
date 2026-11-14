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

/**
 * A share of the shared daily budget for work that must never starve sending (the nightly status
 * check). It refuses once it has taken `maxCalls` itself, without asking the shared budget, and
 * refuses a call the shared budget allowed when that call leaves fewer than `keepFree` for the
 * rest of the day (that call is counted, never sent). Counted per organisation, per instance: the
 * check builds one share for each run.
 */
export class CallBudgetShare implements CallBudget {
  private readonly taken = new Map<string, number>();

  constructor(
    private readonly shared: CallBudget,
    private readonly allowance: { readonly maxCalls: number; readonly keepFree: number },
  ) {}

  async consume(organizationId: string): Promise<BudgetDecision> {
    const taken = this.taken.get(organizationId) ?? 0;
    if (taken >= this.allowance.maxCalls) {
      return { allowed: false, used: taken, limit: this.allowance.maxCalls };
    }
    const decision = await this.shared.consume(organizationId);
    if (!decision.allowed) return decision;
    if (decision.limit - decision.used < this.allowance.keepFree) {
      return { allowed: false, used: decision.used, limit: decision.limit };
    }
    this.taken.set(organizationId, taken + 1);
    return decision;
  }
}
