import { SESSION_LIFETIME_POLICY } from "./session-lifetime-policy.js";

const MAX_REMEMBERED = 10_000;

export interface SessionActivityStore {
  /**
   * Stamps the record's last use, only when it has none or the last stamp is at least
   * `throttleMs` old, and only while it is still signed in. Returns whether a write happened.
   */
  touch(sessionId: string, now: Date, throttleMs: number): Promise<boolean>;
}

/**
 * Records that a sign-in was used (the issuer served its cookie, or a product refreshed under it),
 * so that idle records can be ended. The write is throttled per record by the policy.
 */
export class SessionActivity {
  /** When this process last asked the store to note each record, so a busy browser costs no query. */
  private readonly asked = new Map<string, number>();

  constructor(
    private readonly store: SessionActivityStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(sessionId: string): Promise<void> {
    const now = this.now();
    const throttleMs = SESSION_LIFETIME_POLICY.activityThrottleMs;
    const last = this.asked.get(sessionId);
    // The store decides for good (other instances write too); this only spares it repeat asks.
    if (last !== undefined && now.getTime() - last < throttleMs) return;
    await this.store.touch(sessionId, now, throttleMs);
    if (this.asked.size >= MAX_REMEMBERED) this.asked.clear();
    this.asked.set(sessionId, now.getTime());
  }
}
