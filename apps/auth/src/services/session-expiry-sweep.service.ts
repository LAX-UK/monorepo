export type ExpiredSession = {
  id: string;
  userId: string;
  /** Earlier ids the record stood for. */
  previousSids: readonly string[];
};

export interface SessionExpiryStore {
  /**
   * Takes one batch of records whose time is up, oldest first, skipping any another instance is
   * already working on, and holds them while `beforeDelete` runs. Then, in the same transaction,
   * deletes them (and so their earlier ids) and the OAuth tokens issued under them. Returns what
   * `beforeDelete` returned and how many records went, or null when there was nothing to take.
   * When `beforeDelete` throws nothing is deleted.
   */
  endExpired<T>(
    now: Date,
    limit: number,
    beforeDelete: (batch: readonly ExpiredSession[]) => Promise<T>,
  ): Promise<{ ended: number; prepared: T } | null>;
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
 * Safe to run on every instance at once: each takes a batch the others skip (row locks), so no
 * record is handled twice at the same time. A swept record no longer exists, products already told
 * are not told twice, and a batch that stopped halfway is picked up by the next run.
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
    const result = await this.store.endExpired(this.now(), this.batchSize, (batch) =>
      this.reserveAll(batch),
    );
    if (!result) return 0;
    await Promise.all(result.prepared.map((reservation) => reservation.run()));
    return result.ended;
  }

  /** Written to the durable outbox while the records are still held, before they go. */
  private reserveAll(batch: readonly ExpiredSession[]) {
    const byUser = new Map<string, ExpiredSession[]>();
    for (const session of batch) {
      byUser.set(session.userId, [...(byUser.get(session.userId) ?? []), session]);
    }
    return Promise.all(
      [...byUser].map(([userId, sessions]) =>
        this.ended.reserve({
          userId,
          sessionIds: sessions.flatMap((session) => [session.id, ...session.previousSids]),
        }),
      ),
    );
  }
}
