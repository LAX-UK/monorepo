import { session } from "@auction/identity-db/schema";
import { type SQL, sql } from "drizzle-orm";
import {
  SESSION_LIFETIME_POLICY,
  SHORTEST_ABSOLUTE_MS,
  SHORTEST_IDLE_MS,
} from "../services/session-lifetime-policy.js";

const seconds = (ms: number) => ms / 1000;
const at = (now: Date) => sql`${now.toISOString()}::timestamptz`;

/** Last real use of a record. Deliberately not indexed: it is written on every touch, and an index would stop those updates being HOT. */
export const lastActiveAtColumn = sql`coalesce(${session.lastSeenAt}, ${session.updatedAt})`;
/** First sign-in on the browser. Must match the expression of `session_signed_in_idx`. */
export const signedInAtColumn = sql`coalesce(${session.signedInAt}, ${session.createdAt})`;

/** The staff marker, read the way `DrizzleTwoFactorPolicyStore` reads it. */
export const sessionPersonIsStaff = sql`EXISTS (
  SELECT 1 FROM "identity_access_marker" AS marker
  WHERE marker."subject_id" = ${session.userId}
    AND marker."kind" = 'staff' AND marker."product" IN ('bid', 'shop'))`;

const limit = (staffSeconds: number, clientSeconds: number) =>
  sql`make_interval(secs => CASE WHEN ${sessionPersonIsStaff} THEN ${staffSeconds}::double precision ELSE ${clientSeconds}::double precision END)`;

/**
 * Records that are over at `now` for any reason: expired, idle too long or signed in too long for
 * the person's own limits (policy: `sessionEndReason`). This is the exact rule, for deciding about
 * one record at a time. It is not what the sweep scans with: see `sweepScans`.
 */
export function sessionHasEnded(now: Date): SQL {
  const { client, staff } = SESSION_LIFETIME_POLICY;
  return sql`(
    ${session.expiresAt} <= ${at(now)}
    OR (
      (${lastActiveAtColumn} <= ${at(now)} - make_interval(secs => ${seconds(SHORTEST_IDLE_MS)}::double precision)
        OR ${signedInAtColumn} <= ${at(now)} - make_interval(secs => ${seconds(SHORTEST_ABSOLUTE_MS)}::double precision))
      AND (
        ${lastActiveAtColumn} <= ${at(now)} - ${limit(seconds(staff.idleMs), seconds(client.idleMs))}
        OR ${signedInAtColumn} <= ${at(now)} - ${limit(seconds(staff.absoluteMs), seconds(client.absoluteMs))}
      )
    )
  )`;
}

/** Records still signed in at `now`. */
export function sessionIsLive(now: Date): SQL {
  return sql`NOT ${sessionHasEnded(now)}`;
}

/**
 * `expires_at` held to the person's limits: never later than `lastActive` plus their idle limit or
 * `signedIn` plus their absolute limit. In an UPDATE the new values of the columns are passed
 * in, since a column name there still means the old row. The SQL twin of `clampExpiry`.
 */
export function clampedExpiresAt(
  proposed: SQL | Date,
  signedIn: SQL | Date,
  lastActive: SQL | Date,
): SQL {
  const { client, staff } = SESSION_LIFETIME_POLICY;
  const instant = (value: SQL | Date) => (value instanceof Date ? at(value) : value);
  return sql`LEAST(${instant(proposed)},
    ${instant(lastActive)} + ${limit(seconds(staff.idleMs), seconds(client.idleMs))},
    ${instant(signedIn)} + ${limit(seconds(staff.absoluteMs), seconds(client.absoluteMs))})`;
}

/**
 * What the sweep looks for, as separate scans that are each selective, in order. Together they find
 * every record `sessionHasEnded` would, apart from a client idle for 7 days whose `expires_at` has
 * not passed, which cannot arise: Better Auth's own expiry is 7 days from the last renewal and the
 * clamp (`clampedExpiresAt`) never lets it pass last use plus the idle limit.
 *
 * - expired: `expires_at`, on its index. With the clamp this is where idle and absolute ends land.
 * - client absolute limit: `signed_in_at` on its index. Over for every person (staff limits are shorter).
 * - staff limits: only the few people holding a staff marker are read, then checked exactly.
 */
export function sweepScans(now: Date): SQL[] {
  const { client, staff } = SESSION_LIFETIME_POLICY;
  return [
    sql`${session.expiresAt} <= ${at(now)}`,
    sql`${signedInAtColumn} <= ${at(now)} - make_interval(secs => ${seconds(client.absoluteMs)}::double precision)`,
    sql`${session.userId} IN (
        SELECT marker."subject_id" FROM "identity_access_marker" AS marker
        WHERE marker."kind" = 'staff' AND marker."product" IN ('bid', 'shop'))
      AND (${lastActiveAtColumn} <= ${at(now)} - make_interval(secs => ${seconds(staff.idleMs)}::double precision)
        OR ${signedInAtColumn} <= ${at(now)} - make_interval(secs => ${seconds(staff.absoluteMs)}::double precision))`,
  ];
}
