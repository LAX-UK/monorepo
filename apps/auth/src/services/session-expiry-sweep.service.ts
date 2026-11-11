export type ExpiredSession = {
  id: string;
  userId: string;
  /** Earlier ids the record stood for. */
  previousSids: readonly string[];
};

export interface SessionExpiryStore {
  /** Records whose time is up, oldest first. */
  findExpired(now: Date, limit: number): Promise<ExpiredSession[]>;
  /**
   * One transaction: deletes those of `sessions` that are still expired (and so their earlier ids)
   * and the OAuth tokens issued under them, and returns the ones deleted.
   */
  deleteExpired(sessions: readonly ExpiredSession[], now: Date): Promise<ExpiredSession[]>;
}

/**
 * Ends the products' sessions for a person's sign-in records, written to the durable outbox before
 * the records go, so a crash between the two cannot leave a product signed in.
 */
export interface EndedSessionReservations {
  reserve(input: {
    userId: string;
    sessionIds: readonly string[];
  }): Promise<{ run(): Promise<void> }>;
}

export const SESSION_EXPIRY_BATCH_SIZE = 200;

/**
 * Sign-in records that run out are deleted lazily by Better Auth, only when someone presents the
 * cookie, so a browser nobody uses again would leave its products signed in until their own
 * lifetimes end. This sweep ends such records the way a manual sign-out does: back-channel logout
 * for the record and each earlier id, and the tokens issued under them deleted.
 *
 * Safe to run again at any time: a swept record no longer exists, products already told are not
 * told twice, and a batch that stopped halfway is picked up by the next run.
 */
export class SessionExpirySweep {
  constructor(
    private readonly store: SessionExpiryStore,
    private readonly ended: EndedSessionReservations,
    private readonly now: () => Date = () => new Date(),
    readonly batchSize = SESSION_EXPIRY_BATCH_SIZE,
  ) {}

  /** Sweeps one batch; returns how many records were ended. */
  async run(): Promise<number> {
    const now = this.now();
    const expired = await this.store.findExpired(now, this.batchSize);
    if (expired.length === 0) return 0;
    const byUser = new Map<string, ExpiredSession[]>();
    for (const session of expired) {
      byUser.set(session.userId, [...(byUser.get(session.userId) ?? []), session]);
    }
    const reservations = await Promise.all(
      [...byUser].map(([userId, sessions]) =>
        this.ended.reserve({
          userId,
          sessionIds: sessions.flatMap((session) => [session.id, ...session.previousSids]),
        }),
      ),
    );
    const deleted = await this.store.deleteExpired(expired, now);
    await Promise.all(reservations.map((reservation) => reservation.run()));
    return deleted.length;
  }
}
