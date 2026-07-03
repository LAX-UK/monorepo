import type { Database } from "@auction/db";
import {
  artistProfile,
  kycVerification,
  legalEntity,
  legalEntityDocument,
  user,
} from "@auction/db/schema";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import type { IAdminOnboardingIssuesReader } from "../interfaces/admin-onboarding-issues.reader.js";
import type { AdminOnboardingIssues } from "../interfaces/admin-read-models.js";

export class DrizzleAdminOnboardingIssuesReader implements IAdminOnboardingIssuesReader {
  constructor(private readonly db: Database) {}

  async getOnboardingIssues(): Promise<AdminOnboardingIssues> {
    const staleKycCutoff = new Date(Date.now() - 48 * 3600 * 1000);
    const staleLeadCutoff = new Date(Date.now() - 7 * 86_400_000);
    const [entities, artists, staleKycSessions, pendingDocuments, staleLeadOrganisations] =
      await Promise.all([
        this.db
          .select({
            id: legalEntity.id,
            displayName: legalEntity.displayName,
            status: legalEntity.status,
          })
          .from(legalEntity)
          .where(inArray(legalEntity.status, ["docs_received", "under_review"]))
          .orderBy(asc(legalEntity.displayName))
          .limit(80),
        this.db
          .select({
            id: artistProfile.id,
            displayName: artistProfile.displayName,
            status: artistProfile.status,
          })
          .from(artistProfile)
          .where(eq(artistProfile.status, "pending"))
          .orderBy(asc(artistProfile.displayName))
          .limit(80),
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
          .where(
            and(
              inArray(kycVerification.status, ["created", "requires_input", "processing"]),
              lt(kycVerification.createdAt, staleKycCutoff),
            ),
          )
          .orderBy(desc(kycVerification.createdAt))
          .limit(80),
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
          .where(eq(legalEntityDocument.reviewStatus, "pending"))
          .orderBy(desc(legalEntityDocument.uploadedAt))
          .limit(80),
        this.db
          .select({
            id: legalEntity.id,
            displayName: legalEntity.displayName,
            createdAt: legalEntity.createdAt,
          })
          .from(legalEntity)
          .where(
            and(
              eq(legalEntity.kind, "organisation"),
              eq(legalEntity.status, "lead"),
              lt(legalEntity.createdAt, staleLeadCutoff),
            ),
          )
          .orderBy(asc(legalEntity.createdAt))
          .limit(80),
      ]);
    return {
      entitiesPendingReview: entities as AdminOnboardingIssues["entitiesPendingReview"],
      artistsPendingApproval: artists,
      staleKycSessions: staleKycSessions,
      documentsAwaitingReview: pendingDocuments,
      staleLeadOrganisations,
    };
  }
}
