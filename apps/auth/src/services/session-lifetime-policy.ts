const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** How long one kind of person stays signed in on a browser, and on how many browsers at once. */
export type SessionLifetime = {
  /** A record unused for this long is ended. */
  readonly idleMs: number;
  /** A record ends this long after the person first signed in on the browser, however much it is used. */
  readonly absoluteMs: number;
  /** Most browsers signed in at once; a new sign-in beyond it ends the least recently used. */
  readonly maxBrowsers: number;
};

/**
 * The one place the lengths of a sign-in are decided. Staff are the people holding a staff marker
 * (the same source the social-sign-in and two-step rules read); everyone else is a client.
 * `last_seen_at` is written at most once per `activityThrottleMs` per record.
 */
export const SESSION_LIFETIME_POLICY = {
  client: { idleMs: 7 * DAY_MS, absoluteMs: 30 * DAY_MS, maxBrowsers: 20 },
  staff: { idleMs: 12 * HOUR_MS, absoluteMs: 24 * HOUR_MS, maxBrowsers: 5 },
  activityThrottleMs: 15 * MINUTE_MS,
} as const satisfies {
  client: SessionLifetime;
  staff: SessionLifetime;
  activityThrottleMs: number;
};

export function lifetimeFor(isStaff: boolean): SessionLifetime {
  return isStaff ? SESSION_LIFETIME_POLICY.staff : SESSION_LIFETIME_POLICY.client;
}

/** The shortest idle and absolute limits any record can have: what a candidate scan filters by. */
export const SHORTEST_IDLE_MS = Math.min(
  SESSION_LIFETIME_POLICY.client.idleMs,
  SESSION_LIFETIME_POLICY.staff.idleMs,
);
export const SHORTEST_ABSOLUTE_MS = Math.min(
  SESSION_LIFETIME_POLICY.client.absoluteMs,
  SESSION_LIFETIME_POLICY.staff.absoluteMs,
);

export type SessionTimes = {
  /** Better Auth's own expiry. */
  expiresAt: Date;
  /** Last real use: `last_seen_at`, or for older records the last time Better Auth renewed it. */
  lastActiveAt: Date;
  /** First sign-in on the browser: `signed_in_at`, or for older records the record's own start. */
  signedInAt: Date;
};

export type SessionEndReason = "expired" | "idle" | "absolute";

/**
 * Why a record is over at `now`, or null while it is still signed in. A limit is reached at its
 * own instant. The database sweep applies the same rules in SQL; the integration tests hold the
 * two together.
 */
export function sessionEndReason(
  times: SessionTimes,
  isStaff: boolean,
  now: Date,
): SessionEndReason | null {
  const lifetime = lifetimeFor(isStaff);
  const at = now.getTime();
  if (times.expiresAt.getTime() <= at) return "expired";
  if (times.lastActiveAt.getTime() + lifetime.idleMs <= at) return "idle";
  if (times.signedInAt.getTime() + lifetime.absoluteMs <= at) return "absolute";
  return null;
}

export type ActiveSession = { id: string; lastActiveAt: Date };

/**
 * The records to end so that at most `maxBrowsers` stay signed in: the least recently used first,
 * ties by id. `keepId` (the sign-in that just happened) is never chosen.
 */
export function chooseEvictions(
  live: readonly ActiveSession[],
  keepId: string,
  maxBrowsers: number,
): string[] {
  const excess = live.length - maxBrowsers;
  if (excess <= 0) return [];
  return live
    .filter((candidate) => candidate.id !== keepId)
    .sort(
      (a, b) =>
        a.lastActiveAt.getTime() - b.lastActiveAt.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, excess)
    .map((candidate) => candidate.id);
}
