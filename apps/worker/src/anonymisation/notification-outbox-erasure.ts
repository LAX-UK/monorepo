import { notificationOutbox } from "@auction/db/schema";
import { and, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import type { BidAnonymisationScope } from "./bid-anonymisation-scope.js";

/**
 * Notifications already dispatched (or given up on) keep their row as the record, but lose the
 * message they carried, which names other people (a requester, a bidder) and quotes errors.
 * Notifications still waiting are left alone.
 */
export async function scrubNotificationOutbox(
  tx: ProjectorDbConnection,
  scope: Pick<BidAnonymisationScope, "subjectIds">,
): Promise<number> {
  const rows = await tx
    .update(notificationOutbox)
    .set({ payload: sql`'{}'::jsonb`, lastError: null })
    .where(
      and(
        inArray(notificationOutbox.userId, [...scope.subjectIds]),
        inArray(notificationOutbox.state, ["sent", "failed"]),
        or(
          sql`${notificationOutbox.payload} <> '{}'::jsonb`,
          isNotNull(notificationOutbox.lastError),
        ),
      ),
    )
    .returning({ id: notificationOutbox.id });
  return rows.length;
}
