import {
  bidIdentityDirectory,
  bidUserProfile,
  buyerAgentAuthorisation,
  category,
  legalEntity,
  sale,
  saleRegistration,
  userCategoryInterest,
} from "@auction/db/schema";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
  inMemorySource,
} from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired, saleRef } from "../subject-export-values.js";

export type BidderProfileInput = {
  subjectId: string;
  directoryName: string | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
    mobileCountry: string | null;
    dateOfBirth: string | null;
    signupPersona: string | null;
    termsAcceptedAt: Date | null;
    termsVersion: string | null;
    categoryInterestsOnboardingCompletedAt: Date | null;
    preferredPaddleNumber: number | null;
    createdAt: Date;
  };
  paddles: { paddleNumber: number; sale: { id: string; title: string } }[];
  interests: string[];
  authorisations: {
    id: string;
    organisation: string;
    held: boolean;
    sale: { id: string; title: string } | null;
    validFrom: Date;
    validUntil: Date | null;
    status: string;
    revokedAt: Date | null;
  }[];
};

/**
 * Staff-only and compliance columns of the profile (role, suspension and its reason, AML hold,
 * identity disablement) are never selected, so they cannot reach the file.
 */
export function mapBidderProfile(input: BidderProfileInput, webOrigin: string) {
  const { profile } = input;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  return {
    id: input.subjectId,
    origin: "provided" as const,
    displayName: input.directoryName ?? (name || null),
    paddles: input.paddles.map((paddle) => ({
      paddleNumber: paddle.paddleNumber,
      sale: saleRef(paddle.sale, webOrigin),
    })),
    interests: input.interests,
    onboardingAnswers: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth,
      mobile: profile.mobile,
      mobileCountry: profile.mobileCountry,
      signupPersona: profile.signupPersona,
      termsAcceptedAt: iso(profile.termsAcceptedAt),
      termsVersion: profile.termsVersion,
      interestsCompletedAt: iso(profile.categoryInterestsOnboardingCompletedAt),
      preferredPaddleNumber: profile.preferredPaddleNumber,
    },
    agentAuthorisations: input.authorisations.map((auth) => ({
      id: auth.id,
      organisation: auth.organisation,
      // The agent on an authorisation you gave is another person and is not named.
      yourPart: auth.held ? "holder" : "grantor",
      sale: saleRef(auth.sale, webOrigin),
      validFrom: isoRequired(auth.validFrom),
      validUntil: iso(auth.validUntil),
      status: auth.status,
      revokedAt: iso(auth.revokedAt),
    })),
  };
}

export class BidderProfileCategory extends SourcedExportCategory {
  readonly id = "bidder-profile";
  protected readonly sources: readonly ExportSource[];

  constructor(private readonly deps: SubjectExportDeps) {
    super();
    this.sources = [
      inMemorySource(async (subjectId) => {
        const input = await this.load(subjectId);
        return input ? [{ key: subjectId, record: mapBidderProfile(input, deps.webOrigin) }] : [];
      }),
    ];
  }

  private async load(subjectId: string): Promise<BidderProfileInput | null> {
    const { db } = this.deps;
    const [profile] = await db
      .select({
        firstName: bidUserProfile.firstName,
        lastName: bidUserProfile.lastName,
        mobile: bidUserProfile.mobile,
        mobileCountry: bidUserProfile.mobileCountry,
        dateOfBirth: bidUserProfile.dateOfBirth,
        signupPersona: bidUserProfile.signupPersona,
        termsAcceptedAt: bidUserProfile.termsAcceptedAt,
        termsVersion: bidUserProfile.termsVersion,
        categoryInterestsOnboardingCompletedAt:
          bidUserProfile.categoryInterestsOnboardingCompletedAt,
        preferredPaddleNumber: bidUserProfile.preferredPaddleNumber,
        createdAt: bidUserProfile.createdAt,
      })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, subjectId))
      .limit(1);
    if (!profile) return null;

    const [directory] = await db
      .select({ name: bidIdentityDirectory.name })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, subjectId))
      .limit(1);

    const paddles = await db
      .select({
        paddleNumber: saleRegistration.paddleNumber,
        saleId: sale.id,
        saleTitle: sale.title,
      })
      .from(saleRegistration)
      .innerJoin(sale, eq(sale.id, saleRegistration.saleId))
      .where(and(eq(saleRegistration.userId, subjectId), isNotNull(saleRegistration.paddleNumber)))
      .orderBy(asc(saleRegistration.id));

    const interests = await db
      .select({ name: category.name })
      .from(userCategoryInterest)
      .innerJoin(category, eq(category.id, userCategoryInterest.categoryId))
      .where(eq(userCategoryInterest.userId, subjectId))
      .orderBy(asc(userCategoryInterest.sortOrder));

    const authorisations = await db
      .select({
        id: buyerAgentAuthorisation.id,
        holderId: buyerAgentAuthorisation.userId,
        organisation: legalEntity.displayName,
        saleId: sale.id,
        saleTitle: sale.title,
        validFrom: buyerAgentAuthorisation.validFrom,
        validUntil: buyerAgentAuthorisation.validUntil,
        status: buyerAgentAuthorisation.status,
        revokedAt: buyerAgentAuthorisation.revokedAt,
      })
      .from(buyerAgentAuthorisation)
      .innerJoin(legalEntity, eq(legalEntity.id, buyerAgentAuthorisation.legalEntityId))
      .leftJoin(sale, eq(sale.id, buyerAgentAuthorisation.saleId))
      .where(
        or(
          eq(buyerAgentAuthorisation.userId, subjectId),
          eq(buyerAgentAuthorisation.createdByUserId, subjectId),
        ),
      )
      .orderBy(asc(buyerAgentAuthorisation.id));

    return {
      subjectId,
      directoryName: directory?.name ?? null,
      profile,
      paddles: paddles.flatMap((row) =>
        row.paddleNumber === null
          ? []
          : [{ paddleNumber: row.paddleNumber, sale: { id: row.saleId, title: row.saleTitle } }],
      ),
      interests: interests.map((row) => row.name),
      authorisations: authorisations.map((row) => ({
        id: row.id,
        organisation: row.organisation,
        held: row.holderId === subjectId,
        sale: row.saleId && row.saleTitle ? { id: row.saleId, title: row.saleTitle } : null,
        validFrom: row.validFrom,
        validUntil: row.validUntil,
        status: row.status,
        revokedAt: row.revokedAt,
      })),
    };
  }
}
