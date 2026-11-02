import type { IdentityDatabase } from "@auction/identity-db";
import { oauthApplication, oauthConsent } from "@auction/identity-db/schema";
import { and, asc, eq } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import { isoRequired } from "../values.js";
import { afterKey, countWhere } from "./keyset.js";

type ConsentRow = {
  id: string;
  product: string;
  scopes: string;
  consentGiven: boolean;
  createdAt: Date;
};

export function mapProductAccess(row: ConsentRow) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "product_access",
    version: null,
    choice: row.consentGiven ? "allowed" : "declined",
    acceptedAt: isoRequired(row.createdAt),
    product: row.product,
    scopes: row.scopes.split(/\s+/).filter(Boolean),
  };
}

/**
 * The LAX products the person has allowed to sign them in. Terms, privacy-notice and cookie
 * choices have no server-side record in Identity, so they are not listed here.
 */
export class ConsentsExportCategory extends SourcedExportCategory {
  readonly id = "consents";
  protected readonly sources: readonly ExportSource[];

  constructor(db: IdentityDatabase) {
    super();
    this.sources = [
      {
        count: (subjectId) => countWhere(db, oauthConsent, eq(oauthConsent.userId, subjectId)),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              id: oauthConsent.id,
              product: oauthApplication.name,
              scopes: oauthConsent.scopes,
              consentGiven: oauthConsent.consentGiven,
              createdAt: oauthConsent.createdAt,
            })
            .from(oauthConsent)
            .innerJoin(oauthApplication, eq(oauthApplication.clientId, oauthConsent.clientId))
            .where(and(eq(oauthConsent.userId, subjectId), afterKey(oauthConsent.id, key)))
            .orderBy(asc(oauthConsent.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapProductAccess(row) }));
        },
      },
    ];
  }
}
