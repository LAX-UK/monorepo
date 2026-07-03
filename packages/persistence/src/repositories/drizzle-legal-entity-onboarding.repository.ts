import type { Database } from "@auction/db";
import {
  legalEntity,
  legalEntityAddress,
  legalEntityDocument,
  legalEntityMember,
  legalEntityOnboardingProgress,
  user,
} from "@auction/db/schema";
import type { LegalEntityStatus, OrgOnboardingStepKey } from "@auction/types";
import { and, eq, ne, sql } from "drizzle-orm";
import type {
  AttachOnboardingDocumentInput,
  CreateOrganisationAttemptInput,
  ILegalEntityOnboardingRepository,
  OnboardingAddressRow,
  OnboardingDbExecutor,
  OnboardingDocumentRow,
  OnboardingOrganisationRow,
} from "../interfaces/legal-entity-onboarding.repository.js";
import type { OrganizationOnboardingProfileInput } from "../lib/org-onboarding-mappers.js";

export class DrizzleLegalEntityOnboardingRepository implements ILegalEntityOnboardingRepository {
  constructor(private readonly db: Database) {}

  transaction<T>(fn: (db: OnboardingDbExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async countNonArchivedOrganisationsByCreator(userId: string): Promise<number> {
    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(legalEntity)
      .where(
        and(
          eq(legalEntity.createdByUserId, userId),
          eq(legalEntity.kind, "organisation"),
          ne(legalEntity.status, "archived"),
        ),
      );
    return countRow?.count ?? 0;
  }

  async existsOrganisationSlug(slug: string, db: OnboardingDbExecutor = this.db): Promise<boolean> {
    if (slug.length === 0) return false;
    const existing = await db
      .select({ id: legalEntity.id })
      .from(legalEntity)
      .where(eq(legalEntity.slug, slug))
      .limit(1);
    return existing.length > 0;
  }

  async listOrganisationSlugSuffixes(baseSlug: string): Promise<string[]> {
    const taken = await this.db
      .select({ slug: legalEntity.slug })
      .from(legalEntity)
      .where(sql`${legalEntity.slug} like ${`${baseSlug}-%`}`);
    return taken.map((r) => r.slug).filter(Boolean) as string[];
  }

  async createOrganisationAttempt(
    input: CreateOrganisationAttemptInput,
    db: OnboardingDbExecutor = this.db,
  ): Promise<OnboardingOrganisationRow> {
    if (input.slug.length > 0 && (await this.existsOrganisationSlug(input.slug, db))) {
      throw new Error("slug_taken");
    }

    const [created] = await db
      .insert(legalEntity)
      .values({
        displayName: input.displayName,
        legalName: input.legalName,
        slug: input.slug.length > 0 ? input.slug : null,
        kind: "organisation",
        subkind: input.subkind,
        createdByUserId: input.creatorUserId,
        status: "lead",
        vatNumber: input.vatNumber,
      })
      .returning();
    if (!created) throw new Error("organization_create_failed");

    await db.insert(legalEntityMember).values({
      legalEntityId: created.id,
      userId: input.creatorUserId,
      role: "owner",
      isPrimaryAdmin: true,
      invitedByUserId: input.creatorUserId,
      invitedAt: new Date(),
      acceptedAt: new Date(),
    });

    if (input.primaryAddress) {
      await db.insert(legalEntityAddress).values({
        legalEntityId: created.id,
        addressType: input.primaryAddress.addressType,
        line1: input.primaryAddress.line1,
        line2: input.primaryAddress.line2 ?? null,
        city: input.primaryAddress.city,
        state: input.primaryAddress.state ?? null,
        postalCode: input.primaryAddress.postalCode,
        country: input.primaryAddress.country,
        isDefault: input.primaryAddress.isDefault ?? true,
      });
    }

    return created;
  }

  async findDocumentByUploadObjectId(entityId: string, uploadObjectId: string) {
    const [row] = await this.db
      .select({ id: legalEntityDocument.id })
      .from(legalEntityDocument)
      .where(
        and(
          eq(legalEntityDocument.legalEntityId, entityId),
          eq(legalEntityDocument.uploadObjectId, uploadObjectId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async attachOnboardingDocument(input: AttachOnboardingDocumentInput) {
    const [doc] = await this.db
      .insert(legalEntityDocument)
      .values({
        legalEntityId: input.legalEntityId,
        uploadObjectId: input.uploadObjectId,
        kind: input.kind,
        label: input.label,
        uploadedByUserId: input.uploadedByUserId,
      })
      .returning({ id: legalEntityDocument.id });
    if (!doc) throw new Error("legal_entity_document_insert_failed");
    return doc;
  }

  async findOnboardingDocumentById(entityId: string, documentId: string) {
    const [doc] = await this.db
      .select({ id: legalEntityDocument.id })
      .from(legalEntityDocument)
      .where(
        and(
          eq(legalEntityDocument.id, documentId),
          eq(legalEntityDocument.legalEntityId, entityId),
        ),
      )
      .limit(1);
    return doc ?? null;
  }

  async detachOnboardingDocument(documentId: string): Promise<void> {
    await this.db.delete(legalEntityDocument).where(eq(legalEntityDocument.id, documentId));
  }

  async findOrganisationById(entityId: string): Promise<OnboardingOrganisationRow | null> {
    const [row] = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    return row ?? null;
  }

  async listCompletedStepKeys(entityId: string): Promise<string[]> {
    const rows = await this.db
      .select({ stepKey: legalEntityOnboardingProgress.stepKey })
      .from(legalEntityOnboardingProgress)
      .where(eq(legalEntityOnboardingProgress.legalEntityId, entityId));
    return rows.map((r) => r.stepKey);
  }

  async listDocuments(entityId: string): Promise<OnboardingDocumentRow[]> {
    return this.db
      .select({
        id: legalEntityDocument.id,
        kind: legalEntityDocument.kind,
        label: legalEntityDocument.label,
        reviewStatus: legalEntityDocument.reviewStatus,
      })
      .from(legalEntityDocument)
      .where(eq(legalEntityDocument.legalEntityId, entityId));
  }

  async findRegisteredOfficeAddress(entityId: string): Promise<OnboardingAddressRow | null> {
    const [addr] = await this.db
      .select({
        addressType: legalEntityAddress.addressType,
        line1: legalEntityAddress.line1,
        line2: legalEntityAddress.line2,
        city: legalEntityAddress.city,
        state: legalEntityAddress.state,
        postalCode: legalEntityAddress.postalCode,
        country: legalEntityAddress.country,
        isDefault: legalEntityAddress.isDefault,
      })
      .from(legalEntityAddress)
      .where(
        and(
          eq(legalEntityAddress.legalEntityId, entityId),
          eq(legalEntityAddress.addressType, "registered_office"),
        ),
      )
      .limit(1);
    return addr ?? null;
  }

  async hasRegisteredOfficeAddress(entityId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: legalEntityAddress.id })
      .from(legalEntityAddress)
      .where(
        and(
          eq(legalEntityAddress.legalEntityId, entityId),
          eq(legalEntityAddress.addressType, "registered_office"),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async updateProfileWithAddress(
    entityId: string,
    profile: {
      displayName: string;
      legalName: string | null;
      vatNumber: string | null;
    },
    address: OrganizationOnboardingProfileInput["primaryAddress"],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(legalEntity)
        .set({
          displayName: profile.displayName,
          legalName: profile.legalName,
          vatNumber: profile.vatNumber,
          updatedAt: new Date(),
        })
        .where(eq(legalEntity.id, entityId));

      const existing = await tx
        .select({ id: legalEntityAddress.id })
        .from(legalEntityAddress)
        .where(
          and(
            eq(legalEntityAddress.legalEntityId, entityId),
            eq(legalEntityAddress.addressType, address.addressType),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await tx
          .update(legalEntityAddress)
          .set({
            line1: address.line1,
            line2: address.line2 ?? null,
            city: address.city,
            state: address.state ?? null,
            postalCode: address.postalCode,
            country: address.country,
            isDefault: address.isDefault ?? true,
          })
          .where(eq(legalEntityAddress.id, existing[0].id));
      } else {
        await tx.insert(legalEntityAddress).values({
          legalEntityId: entityId,
          addressType: address.addressType,
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city,
          state: address.state ?? null,
          postalCode: address.postalCode,
          country: address.country,
          isDefault: address.isDefault ?? true,
        });
      }
    });
  }

  async markStepComplete(entityId: string, step: OrgOnboardingStepKey): Promise<void> {
    await this.db
      .insert(legalEntityOnboardingProgress)
      .values({
        legalEntityId: entityId,
        stepKey: step,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          legalEntityOnboardingProgress.legalEntityId,
          legalEntityOnboardingProgress.stepKey,
        ],
        set: { completedAt: sql`excluded.completed_at` },
      });
  }

  async findUserKycStatus(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ kycStatus: user.kycStatus })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.kycStatus ?? null;
  }

  async lockOrganisationForUpdate(
    entityId: string,
    db: OnboardingDbExecutor = this.db,
  ): Promise<OnboardingOrganisationRow | null> {
    const [row] = await db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .for("update")
      .limit(1);
    return row ?? null;
  }

  async transitionOrganisationStatus(
    input: {
      entityId: string;
      userId: string;
      toStatus: LegalEntityStatus;
    },
    db: OnboardingDbExecutor = this.db,
  ): Promise<void> {
    await db
      .update(legalEntity)
      .set({
        status: input.toStatus,
        statusChangedAt: new Date(),
        statusChangedByUserId: input.userId,
        updatedAt: new Date(),
      })
      .where(eq(legalEntity.id, input.entityId));
  }
}
