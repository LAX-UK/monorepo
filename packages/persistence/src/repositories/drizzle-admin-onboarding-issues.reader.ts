import type { Database } from "@auction/db";
import {
  artistProfile,
  kycVerification,
  legalEntity,
  legalEntityDocument,
  user,
} from "@auction/db/schema";
import { type SQL, and, asc, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { IAdminOnboardingIssuesReader } from "../interfaces/admin-onboarding-issues.reader.js";
import type {
  AdminOnboardingArtistRow,
  AdminOnboardingArtistsLensSummary,
  AdminOnboardingDocumentRow,
  AdminOnboardingDocumentsLensSummary,
  AdminOnboardingEntitiesLensSummary,
  AdminOnboardingIssuesCrossSummary,
  AdminOnboardingIssuesListResult,
  AdminOnboardingIssuesTab,
  AdminOnboardingKycLensSummary,
  AdminOnboardingKycSessionRow,
  AdminOnboardingLegalEntityRow,
  AdminOnboardingOrganizationsLensSummary,
  AdminOnboardingStaleLeadRow,
} from "../interfaces/admin-read-models.js";

const STALE_KYC_MS = 48 * 3600 * 1000;
const STALE_LEAD_MS = 7 * 86_400_000;

function staleKycCutoff(now = Date.now()): Date {
  return new Date(now - STALE_KYC_MS);
}

function staleLeadCutoff(now = Date.now()): Date {
  return new Date(now - STALE_LEAD_MS);
}

const entitiesPendingReviewWhere = inArray(legalEntity.status, ["docs_received", "under_review"]);
const artistsPendingApprovalWhere = eq(artistProfile.status, "pending");
const staleKycWhere = (cutoff: Date) =>
  and(
    inArray(kycVerification.status, ["created", "requires_input", "processing"]),
    lt(kycVerification.createdAt, cutoff),
  );
const documentsAwaitingReviewWhere = eq(legalEntityDocument.reviewStatus, "pending");
const staleLeadOrganisationsWhere = (cutoff: Date) =>
  and(
    eq(legalEntity.kind, "organisation"),
    eq(legalEntity.status, "lead"),
    lt(legalEntity.createdAt, cutoff),
  );

async function countWhere(db: Database, table: PgTable, where?: SQL): Promise<number> {
  const query = db.select({ n: count() }).from(table);
  const [row] = where ? await query.where(where) : await query;
  return Number(row?.n ?? 0);
}

export class DrizzleAdminOnboardingIssuesReader implements IAdminOnboardingIssuesReader {
  constructor(private readonly db: Database) {}

  async summarizeAllQueues(): Promise<AdminOnboardingIssuesCrossSummary> {
    const kycCutoff = staleKycCutoff();
    const leadCutoff = staleLeadCutoff();
    const [entities, artists, kyc, documents, organizations] = await Promise.all([
      countWhere(this.db, legalEntity, entitiesPendingReviewWhere),
      countWhere(this.db, artistProfile, artistsPendingApprovalWhere),
      this.db
        .select({ n: count() })
        .from(kycVerification)
        .where(staleKycWhere(kycCutoff))
        .then(([row]) => Number(row?.n ?? 0)),
      this.db
        .select({ n: count() })
        .from(legalEntityDocument)
        .where(documentsAwaitingReviewWhere)
        .then(([row]) => Number(row?.n ?? 0)),
      countWhere(this.db, legalEntity, staleLeadOrganisationsWhere(leadCutoff)),
    ]);
    return {
      entities,
      artists,
      kyc,
      documents,
      organizations,
      queueTotal: entities + artists + kyc + documents + organizations,
    };
  }

  async listEntitiesPendingReview(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingLegalEntityRow>> {
    const limit = Math.min(Math.max(input.limit, 1), 200);
    const offset = Math.max(input.offset, 0);
    const [total, rows] = await Promise.all([
      countWhere(this.db, legalEntity, entitiesPendingReviewWhere),
      this.db
        .select({
          id: legalEntity.id,
          displayName: legalEntity.displayName,
          status: legalEntity.status,
          createdAt: legalEntity.createdAt,
          updatedAt: legalEntity.updatedAt,
          statusChangedAt: legalEntity.statusChangedAt,
        })
        .from(legalEntity)
        .where(entitiesPendingReviewWhere)
        .orderBy(asc(legalEntity.displayName))
        .limit(limit)
        .offset(offset),
    ]);
    return { total, rows: rows as AdminOnboardingLegalEntityRow[] };
  }

  async summarizeEntitiesPendingReview(): Promise<AdminOnboardingEntitiesLensSummary> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        docsReceived: sql<number>`count(*) filter (where ${legalEntity.status} = 'docs_received')::int`,
        underReview: sql<number>`count(*) filter (where ${legalEntity.status} = 'under_review')::int`,
      })
      .from(legalEntity)
      .where(entitiesPendingReviewWhere);
    return {
      total: row?.total ?? 0,
      docsReceived: row?.docsReceived ?? 0,
      underReview: row?.underReview ?? 0,
    };
  }

  async listArtistsPendingApproval(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingArtistRow>> {
    const limit = Math.min(Math.max(input.limit, 1), 200);
    const offset = Math.max(input.offset, 0);
    const [total, rows] = await Promise.all([
      countWhere(this.db, artistProfile, artistsPendingApprovalWhere),
      this.db
        .select({
          id: artistProfile.id,
          displayName: artistProfile.displayName,
          status: artistProfile.status,
          createdAt: artistProfile.createdAt,
        })
        .from(artistProfile)
        .where(artistsPendingApprovalWhere)
        .orderBy(asc(artistProfile.displayName))
        .limit(limit)
        .offset(offset),
    ]);
    return { total, rows };
  }

  async summarizeArtistsPendingApproval(): Promise<AdminOnboardingArtistsLensSummary> {
    const total = await countWhere(this.db, artistProfile, artistsPendingApprovalWhere);
    return { total };
  }

  async listStaleKycSessions(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingKycSessionRow>> {
    const limit = Math.min(Math.max(input.limit, 1), 200);
    const offset = Math.max(input.offset, 0);
    const cutoff = staleKycCutoff();
    const where = staleKycWhere(cutoff);
    const [total, rows] = await Promise.all([
      this.db
        .select({ n: count() })
        .from(kycVerification)
        .where(where)
        .then(([row]) => Number(row?.n ?? 0)),
      this.db
        .select({
          id: kycVerification.id,
          userId: kycVerification.userId,
          userName: user.name,
          userEmail: user.email,
          provider: kycVerification.provider,
          status: kycVerification.status,
          createdAt: kycVerification.createdAt,
        })
        .from(kycVerification)
        .innerJoin(user, eq(kycVerification.userId, user.id))
        .where(where)
        .orderBy(desc(kycVerification.createdAt))
        .limit(limit)
        .offset(offset),
    ]);
    return { total, rows };
  }

  async summarizeStaleKycSessions(): Promise<AdminOnboardingKycLensSummary> {
    const cutoff = staleKycCutoff();
    const where = staleKycWhere(cutoff);
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        created: sql<number>`count(*) filter (where ${kycVerification.status} = 'created')::int`,
        requiresInput: sql<number>`count(*) filter (where ${kycVerification.status} = 'requires_input')::int`,
        processing: sql<number>`count(*) filter (where ${kycVerification.status} = 'processing')::int`,
      })
      .from(kycVerification)
      .where(where);
    return {
      total: row?.total ?? 0,
      created: row?.created ?? 0,
      requiresInput: row?.requiresInput ?? 0,
      processing: row?.processing ?? 0,
    };
  }

  async listDocumentsAwaitingReview(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingDocumentRow>> {
    const limit = Math.min(Math.max(input.limit, 1), 200);
    const offset = Math.max(input.offset, 0);
    const [total, rows] = await Promise.all([
      this.db
        .select({ n: count() })
        .from(legalEntityDocument)
        .where(documentsAwaitingReviewWhere)
        .then(([row]) => Number(row?.n ?? 0)),
      this.db
        .select({
          id: legalEntityDocument.id,
          legalEntityId: legalEntityDocument.legalEntityId,
          entityDisplayName: legalEntity.displayName,
          uploadObjectId: legalEntityDocument.uploadObjectId,
          uploadedAt: legalEntityDocument.uploadedAt,
        })
        .from(legalEntityDocument)
        .innerJoin(legalEntity, eq(legalEntityDocument.legalEntityId, legalEntity.id))
        .where(documentsAwaitingReviewWhere)
        .orderBy(desc(legalEntityDocument.uploadedAt))
        .limit(limit)
        .offset(offset),
    ]);
    return { total, rows };
  }

  async summarizeDocumentsAwaitingReview(): Promise<AdminOnboardingDocumentsLensSummary> {
    const total = await this.db
      .select({ n: count() })
      .from(legalEntityDocument)
      .where(documentsAwaitingReviewWhere)
      .then(([row]) => Number(row?.n ?? 0));
    return { total };
  }

  async listStaleLeadOrganisations(input: {
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesListResult<AdminOnboardingStaleLeadRow>> {
    const limit = Math.min(Math.max(input.limit, 1), 200);
    const offset = Math.max(input.offset, 0);
    const cutoff = staleLeadCutoff();
    const where = staleLeadOrganisationsWhere(cutoff);
    const [total, rows] = await Promise.all([
      countWhere(this.db, legalEntity, where),
      this.db
        .select({
          id: legalEntity.id,
          displayName: legalEntity.displayName,
          createdAt: legalEntity.createdAt,
        })
        .from(legalEntity)
        .where(where)
        .orderBy(asc(legalEntity.createdAt))
        .limit(limit)
        .offset(offset),
    ]);
    return { total, rows };
  }

  async summarizeStaleLeadOrganisations(): Promise<AdminOnboardingOrganizationsLensSummary> {
    const total = await countWhere(
      this.db,
      legalEntity,
      staleLeadOrganisationsWhere(staleLeadCutoff()),
    );
    return { total };
  }

  async findRowById(
    tab: AdminOnboardingIssuesTab,
    id: string,
  ): Promise<
    | AdminOnboardingLegalEntityRow
    | AdminOnboardingArtistRow
    | AdminOnboardingKycSessionRow
    | AdminOnboardingDocumentRow
    | AdminOnboardingStaleLeadRow
    | null
  > {
    switch (tab) {
      case "entities": {
        const [row] = await this.db
          .select({
            id: legalEntity.id,
            displayName: legalEntity.displayName,
            status: legalEntity.status,
            createdAt: legalEntity.createdAt,
            updatedAt: legalEntity.updatedAt,
            statusChangedAt: legalEntity.statusChangedAt,
          })
          .from(legalEntity)
          .where(and(entitiesPendingReviewWhere, eq(legalEntity.id, id)))
          .limit(1);
        return (row as AdminOnboardingLegalEntityRow | undefined) ?? null;
      }
      case "artists": {
        const [row] = await this.db
          .select({
            id: artistProfile.id,
            displayName: artistProfile.displayName,
            status: artistProfile.status,
            createdAt: artistProfile.createdAt,
          })
          .from(artistProfile)
          .where(and(artistsPendingApprovalWhere, eq(artistProfile.id, id)))
          .limit(1);
        return (row as AdminOnboardingArtistRow | undefined) ?? null;
      }
      case "kyc": {
        const cutoff = staleKycCutoff();
        const where = and(staleKycWhere(cutoff), eq(kycVerification.id, id));
        const [row] = await this.db
          .select({
            id: kycVerification.id,
            userId: kycVerification.userId,
            userName: user.name,
            userEmail: user.email,
            provider: kycVerification.provider,
            status: kycVerification.status,
            createdAt: kycVerification.createdAt,
          })
          .from(kycVerification)
          .innerJoin(user, eq(kycVerification.userId, user.id))
          .where(where)
          .limit(1);
        return row ?? null;
      }
      case "documents": {
        const [row] = await this.db
          .select({
            id: legalEntityDocument.id,
            legalEntityId: legalEntityDocument.legalEntityId,
            entityDisplayName: legalEntity.displayName,
            uploadObjectId: legalEntityDocument.uploadObjectId,
            uploadedAt: legalEntityDocument.uploadedAt,
          })
          .from(legalEntityDocument)
          .innerJoin(legalEntity, eq(legalEntityDocument.legalEntityId, legalEntity.id))
          .where(and(documentsAwaitingReviewWhere, eq(legalEntityDocument.id, id)))
          .limit(1);
        return row ?? null;
      }
      case "organizations": {
        const cutoff = staleLeadCutoff();
        const where = and(staleLeadOrganisationsWhere(cutoff), eq(legalEntity.id, id));
        const [row] = await this.db
          .select({
            id: legalEntity.id,
            displayName: legalEntity.displayName,
            createdAt: legalEntity.createdAt,
          })
          .from(legalEntity)
          .where(where)
          .limit(1);
        return row ?? null;
      }
      default: {
        const _exhaustive: never = tab;
        throw new Error(`Unsupported onboarding tab: ${String(_exhaustive)}`);
      }
    }
  }
}
