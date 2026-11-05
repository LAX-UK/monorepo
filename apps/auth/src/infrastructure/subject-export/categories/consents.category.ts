import {
  LEGAL_DOCUMENT_PRODUCT_NAMES,
  LEGAL_ENTITY_NAMES,
  type LegalDocumentProduct,
  type LegalEntityId,
} from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import {
  oauthApplication,
  oauthConsent,
  subjectLegalAcceptance,
} from "@auction/identity-db/schema";
import { and, asc, eq } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
} from "../../../subject-export/sourced-export-category.js";
import { isoRequired } from "../../../subject-export/values.js";
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

type LegalAcceptanceExportRow = {
  id: string;
  documentKind: string;
  documentVersion: string;
  legalEntity: string;
  product: string;
  acceptedAt: Date;
};

/** The Terms or Privacy notice accepted when the person created their account. */
export function mapLegalAcceptance(row: LegalAcceptanceExportRow) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: row.documentKind,
    version: row.documentVersion,
    choice: "accepted",
    acceptedAt: isoRequired(row.acceptedAt),
    product: LEGAL_DOCUMENT_PRODUCT_NAMES[row.product as LegalDocumentProduct] ?? row.product,
    company: LEGAL_ENTITY_NAMES[row.legalEntity as LegalEntityId] ?? row.legalEntity,
  };
}

/**
 * The Terms and Privacy notice the person accepted when they created their account, and the LAX
 * products they have allowed to sign them in. Cookie choices have no server-side record in
 * Identity, so they are not listed here.
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
      {
        count: (subjectId) =>
          countWhere(db, subjectLegalAcceptance, eq(subjectLegalAcceptance.subjectId, subjectId)),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              id: subjectLegalAcceptance.id,
              documentKind: subjectLegalAcceptance.documentKind,
              documentVersion: subjectLegalAcceptance.documentVersion,
              legalEntity: subjectLegalAcceptance.legalEntity,
              product: subjectLegalAcceptance.product,
              acceptedAt: subjectLegalAcceptance.acceptedAt,
            })
            .from(subjectLegalAcceptance)
            .where(
              and(
                eq(subjectLegalAcceptance.subjectId, subjectId),
                afterKey(subjectLegalAcceptance.id, key),
              ),
            )
            .orderBy(asc(subjectLegalAcceptance.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapLegalAcceptance(row) }));
        },
      },
    ];
  }
}
