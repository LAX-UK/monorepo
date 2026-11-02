import type {
  BidUserContext,
  IBidUserContextLoader,
} from "../services/interfaces/bid-user-context.js";

/** Longest a staff member's access can lag behind a role change, suspension or disablement. */
export const STAFF_CONTEXT_TTL_MS = 15_000;

const MAX_ENTRIES = 500;

type Entry = { context: BidUserContext; expiresAt: number };

/**
 * Spares the database a profile and role-assignment read on every request a staff member makes.
 * Only staff are cached; everyone else is read fresh. The cache is per process and is not
 * invalidated by role changes, so the short expiry is what bounds how stale access can be.
 */
export class ShortLivedStaffContextLoader implements IBidUserContextLoader {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly delegate: IBidUserContextLoader,
    private readonly ttlMs: number = STAFF_CONTEXT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async loadContext(userId: string): Promise<BidUserContext | null> {
    const cached = this.entries.get(userId);
    if (cached && cached.expiresAt > this.now()) return cached.context;
    this.entries.delete(userId);

    const context = await this.delegate.loadContext(userId);
    if (context?.role === "staff") this.remember(userId, context);
    return context;
  }

  private remember(userId: string, context: BidUserContext): void {
    if (this.entries.size >= MAX_ENTRIES) this.evictExpired();
    if (this.entries.size >= MAX_ENTRIES) return;
    this.entries.set(userId, { context, expiresAt: this.now() + this.ttlMs });
  }

  private evictExpired(): void {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(id);
  }
}
