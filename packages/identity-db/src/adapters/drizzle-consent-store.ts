import type { ConsentRecord, ConsentStore } from "@auction/identity-contracts";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../schema/index.js";
import { oauthConsent } from "../schema/oauth.js";

export type IdentityDatabase = NodePgDatabase<typeof schema>;

export function createDrizzleConsentStore(db: IdentityDatabase): ConsentStore {
  return {
    async upsert(input: ConsentRecord) {
      const [row] = await db
        .insert(oauthConsent)
        .values({
          id: input.id,
          clientId: input.clientId,
          userId: input.userId,
          scopes: input.scopes,
          consentGiven: input.consentGiven,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
        })
        .onConflictDoUpdate({
          target: [oauthConsent.clientId, oauthConsent.userId],
          set: {
            consentGiven: sql`excluded.consent_given`,
            scopes: sql`(
              select coalesce(string_agg(distinct s, ' ' order by s), '')
              from unnest(
                string_to_array(
                  ${oauthConsent.scopes} || ' ' || excluded.scopes,
                  ' '
                )
              ) as s
              where s <> ''
            )`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .returning();
      if (!row) {
        throw new Error("oauth consent upsert returned no row");
      }
      return row;
    },
  };
}
