import type { IdentityDatabase } from "@auction/identity-db";
import { oauthAccessToken, sessionLineage } from "@auction/identity-db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { SessionClientsReader } from "./subject-export/categories/sign-in-and-security.category.js";

/**
 * The OAuth clients each sign-in record was used for. A product's tokens carry the id the sign-in
 * had when they were issued, so a record that took over an earlier one answers for the earlier
 * ids too. Only the client ids are selected, never a token, and only for the one person asked
 * about.
 *
 * Its rows reach the "Download my data" file, so it is held to the export exclusions contract
 * (`subject-export/categories/exclusions.queries.contract.test.ts`): it may name only
 * `oauthAccessToken.sid`, `.clientId` and `.userId`, and the table only in `.from(...)`.
 */
export function createDrizzleSessionClientsReader(db: IdentityDatabase): SessionClientsReader {
  return async (subjectId, sessionIds) => {
    const result = new Map<string, string[]>();
    if (sessionIds.length === 0) return result;
    const lineage = await db
      .select({ previousSid: sessionLineage.previousSid, sessionId: sessionLineage.sessionId })
      .from(sessionLineage)
      .where(
        and(
          eq(sessionLineage.userId, subjectId),
          inArray(sessionLineage.sessionId, [...sessionIds]),
        ),
      );
    const owner = new Map<string, string>(sessionIds.map((id) => [id, id]));
    for (const entry of lineage) owner.set(entry.previousSid, entry.sessionId);
    const tokens = await db
      .selectDistinct({ sid: oauthAccessToken.sid, clientId: oauthAccessToken.clientId })
      .from(oauthAccessToken)
      .where(
        and(
          eq(oauthAccessToken.userId, subjectId),
          inArray(oauthAccessToken.sid, [...owner.keys()]),
        ),
      );
    for (const { sid, clientId } of tokens) {
      const id = sid ? owner.get(sid) : undefined;
      if (!id) continue;
      const known = result.get(id) ?? [];
      if (!known.includes(clientId)) result.set(id, [...known, clientId]);
    }
    return result;
  };
}
