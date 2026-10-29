import type { LegalEntitySummary } from "@auction/types";
import type { AccountsLookup } from "./account-directory";

type Entry = { accounts: readonly LegalEntitySummary[]; storedAt: number };

export type AccountsCacheOptions = {
  /** How long an answer is reused. Short: it only absorbs bursts (prefetches, parallel loads). */
  ttlMs: number;
  /** Sessions kept at once; the oldest is dropped first. */
  maxEntries: number;
  now?: () => number;
};

function includes(accounts: readonly LegalEntitySummary[], accountId?: string | null): boolean {
  return !accountId || accounts.some((account) => account.id === accountId);
}

/**
 * A short, private, per-session memory of the person's accounts, so ordinary browsing (each
 * page, its prefetches, the API calls a page makes in parallel) asks the API once. Concurrent
 * reads for one session share a single request. Only successful answers are kept, and a kept
 * answer is never trusted to rule an account out (see `mustInclude`).
 */
export class AccountsCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inFlight = new Map<string, Promise<AccountsLookup>>();
  private readonly now: () => number;

  constructor(private readonly options: AccountsCacheOptions) {
    this.now = options.now ?? Date.now;
  }

  /**
   * The session's accounts: a fresh kept answer, the request already under way, or a new one
   * from `load`. An answer without `mustInclude` is not used (the membership may be new, perhaps
   * added through another server), and the accounts are read again.
   */
  async getOrLoad(
    sessionKey: string,
    mustInclude: string | null | undefined,
    load: () => Promise<AccountsLookup>,
  ): Promise<AccountsLookup> {
    const kept = this.fresh(sessionKey);
    if (kept && includes(kept, mustInclude)) return { ok: true, accounts: kept };

    const pending = this.inFlight.get(sessionKey);
    if (pending) {
      const shared = await pending;
      if (!shared.ok || includes(shared.accounts, mustInclude)) return shared;
    }
    return this.loadOnce(sessionKey, load);
  }

  /** Drops the session's answer after its memberships changed (an invitation accepted). */
  forget(sessionKey: string): void {
    this.entries.delete(sessionKey);
    // A read already under way may predate the change: its answer is returned, never kept.
    this.inFlight.delete(sessionKey);
  }

  private async loadOnce(
    sessionKey: string,
    load: () => Promise<AccountsLookup>,
  ): Promise<AccountsLookup> {
    const request = load();
    this.inFlight.set(sessionKey, request);
    try {
      const result = await request;
      if (result.ok && this.inFlight.get(sessionKey) === request) {
        this.store(sessionKey, result.accounts);
      }
      return result;
    } finally {
      if (this.inFlight.get(sessionKey) === request) this.inFlight.delete(sessionKey);
    }
  }

  private fresh(sessionKey: string): readonly LegalEntitySummary[] | null {
    const entry = this.entries.get(sessionKey);
    if (!entry) return null;
    if (this.now() - entry.storedAt < this.options.ttlMs) return entry.accounts;
    this.entries.delete(sessionKey);
    return null;
  }

  private store(sessionKey: string, accounts: readonly LegalEntitySummary[]): void {
    this.entries.delete(sessionKey);
    this.entries.set(sessionKey, { accounts, storedAt: this.now() });
    while (this.entries.size > this.options.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
