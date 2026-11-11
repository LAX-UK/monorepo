import { session } from "@auction/identity-db/schema";
import { type SQL, sql } from "drizzle-orm";
import {
  SESSION_LIFETIME_POLICY,
  SHORTEST_ABSOLUTE_MS,
  SHORTEST_IDLE_MS,
} from "../services/session-lifetime-policy.js";

const seconds = (ms: number) => ms / 1000;
const at = (now: Date) => sql`${now.toISOString()}::timestamptz`;

/** Last real use of a record. Must match the expression of `session_last_active_idx`. */
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
 * the person's own limits (policy: `sessionEndReason`). The first three terms use the shortest
 * limits any record has, so the indexes narrow the scan before the exact limits are applied.
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
