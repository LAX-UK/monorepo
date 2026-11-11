/** Most earlier names (sign-in ids) one record keeps; the oldest are dropped first. */
export const MAX_LINEAGE_PER_SESSION = 20;

/** A sign-in record, as far as taking over is concerned. */
export type SessionSnapshot = {
  id: string;
  userId: string;
  /** When the person first signed in on this browser: the record's own start if none was carried. */
  signedInAt: Date;
  /** Earlier ids this record already stands for. */
  previousSids: readonly string[];
};

export type NewSession = { id: string; userId: string; createdAt: Date };

export type TakeoverPlan = {
  /** The same person's records in this browser: deleted, remembered as earlier names. */
  sameSubject: SessionSnapshot[];
  /** Another person's records in this browser: ended, with a back-channel sign-out. */
  otherSubject: SessionSnapshot[];
  /** The original start of the sign-in, carried over to the new record. */
  signedInAt: Date;
};

/**
 * Decides what a new sign-in does to the records the same browser already had. Whose record it is
 * comes from the signed-in person on each record, never from the device marker.
 */
export function planTakeover(fresh: NewSession, prior: readonly SessionSnapshot[]): TakeoverPlan {
  const sameSubject = prior.filter((session) => session.userId === fresh.userId);
  const otherSubject = prior.filter((session) => session.userId !== fresh.userId);
  const signedInAt = sameSubject.reduce(
    (earliest, session) => (session.signedInAt < earliest ? session.signedInAt : earliest),
    fresh.createdAt,
  );
  return { sameSubject, otherSubject, signedInAt };
}

export type TakeoverWrite = TakeoverPlan & {
  newSessionId: string;
  userId: string;
  deviceHash: string | null;
  country: string | null;
  maxLineage: number;
  now: Date;
};

export interface SessionTakeoverStore {
  findSession(sessionId: string): Promise<NewSession | null>;
  /**
   * Records still signed in, other than `excludeId`, that are the named previous record or carry
   * the same device hash.
   */
  findLive(input: {
    previousSessionId: string | null;
    deviceHash: string | null;
    excludeId: string;
    now: Date;
  }): Promise<SessionSnapshot[]>;
  /** One transaction: remember, repoint, delete the old records and stamp the new one. */
  replace(write: TakeoverWrite): Promise<void>;
}

/** Ends another person's relying-party sessions for records that were just deleted. */
export interface EndedSessionNotifier {
  ended(input: { userId: string; sessionIds: readonly string[] }): Promise<void>;
}

/**
 * One rule for every sign-in that sets a new session cookie (password, email link, Google or
 * Apple, two-step, passkey, "Confirm it's you", switching account): the new record takes over what
 * the browser already had.
 *
 * - Same person: the old record is deleted and its id is kept as an earlier name of the new one,
 *   so a product that still holds the old id keeps working. The original sign-in time is carried.
 * - Different person: the old record is ended completely, with a back-channel sign-out for every
 *   id it stood for, so the previous person is signed out of every LAX product in this browser.
 */
export class SessionTakeoverService {
  constructor(
    private readonly store: SessionTakeoverStore,
    private readonly ended: EndedSessionNotifier,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async takeOver(input: {
    newSessionId: string;
    previousSessionId: string | null;
    deviceHash: string | null;
    country: string | null;
  }): Promise<void> {
    const fresh = await this.store.findSession(input.newSessionId);
    if (!fresh) return;
    const now = this.now();
    const prior = await this.store.findLive({
      previousSessionId: input.previousSessionId,
      deviceHash: input.deviceHash,
      excludeId: fresh.id,
      now,
    });
    const plan = planTakeover(fresh, prior);
    await this.store.replace({
      ...plan,
      newSessionId: fresh.id,
      userId: fresh.userId,
      deviceHash: input.deviceHash,
      country: input.country,
      maxLineage: MAX_LINEAGE_PER_SESSION,
      now,
    });
    await Promise.all(
      groupByUser(plan.otherSubject).map(([userId, sessions]) =>
        this.ended.ended({
          userId,
          sessionIds: sessions.flatMap((session) => [session.id, ...session.previousSids]),
        }),
      ),
    );
  }
}

function groupByUser(sessions: readonly SessionSnapshot[]): [string, SessionSnapshot[]][] {
  const byUser = new Map<string, SessionSnapshot[]>();
  for (const session of sessions) {
    byUser.set(session.userId, [...(byUser.get(session.userId) ?? []), session]);
  }
  return [...byUser];
}
