import type { EndedSessionReservations, ExpiredSession } from "./session-expiry-sweep.service.js";
import {
  type ActiveSession,
  type SessionTimes,
  chooseEvictions,
  lifetimeFor,
  sessionEndReason,
} from "./session-lifetime-policy.js";

export type HeldSession = SessionTimes & ActiveSession;

export interface SessionCapStore {
  /** People who may be over their cap, up to `limit`. */
  findOverCap(limit: number): Promise<string[]>;
  /**
   * Locks the person's records, asks `choose` which of them to end, and ends those the way a
   * sign-out does (see `endLockedSessions`) in the same transaction, after `beforeDelete` has made
   * the sign-out durable. Returns null when `choose` names none.
   */
  endChosen<T>(
    userId: string,
    choose: (held: { isStaff: boolean; sessions: readonly HeldSession[] }) => readonly string[],
    beforeDelete: (batch: readonly ExpiredSession[]) => Promise<T>,
  ): Promise<{ ended: number; prepared: T } | null>;
}

/**
 * A person is signed in on at most 20 browsers (5 for staff). A new sign-in beyond that ends the
 * least recently used record, completely: back-channel logout for it and every earlier id, its
 * tokens deleted, a `session_revoked` announced for each id. No security notice goes out; the
 * person did nothing wrong and the browser that lost its sign-in is simply the one used longest ago.
 *
 * Records already over by their own limits are not counted: the sweep ends them. The sign-in that
 * triggered this is never the one ended.
 */
export class SessionCap {
  constructor(
    private readonly store: SessionCapStore,
    private readonly ended: EndedSessionReservations,
    private readonly now: () => Date = () => new Date(),
    private readonly onFailed?: (error: unknown, userId: string) => void,
  ) {}

  /**
   * The safety net behind sign-in: holds anyone over their cap to it, for a cap that was missed
   * when the person signed in (the cap's transaction failed, or the person was promoted to staff).
   * A person that fails is reported and does not stop the others. Returns how many records ended.
   */
  async enforceOverCap(limit = 100): Promise<number> {
    let ended = 0;
    for (const userId of await this.store.findOverCap(limit)) {
      try {
        ended += await this.enforce({ userId, keepSessionId: "" });
      } catch (error) {
        this.onFailed?.(error, userId);
      }
    }
    return ended;
  }

  /** Returns how many records were ended. */
  async enforce(input: { userId: string; keepSessionId: string }): Promise<number> {
    const now = this.now();
    const result = await this.store.endChosen(
      input.userId,
      ({ isStaff, sessions }) =>
        chooseEvictions(
          sessions.filter((held) => sessionEndReason(held, isStaff, now) === null),
          input.keepSessionId,
          lifetimeFor(isStaff).maxBrowsers,
        ),
      (batch) =>
        Promise.all(
          batch.map((record) =>
            this.ended.reserve({
              userId: input.userId,
              sessionIds: [record.id, ...record.previousSids],
            }),
          ),
        ),
    );
    if (!result) return 0;
    await Promise.all(result.prepared.map((reservation) => reservation.run()));
    return result.ended;
  }
}
