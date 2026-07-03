import type { Database } from "@auction/db";
import {
  legalEntity,
  legalEntityAddress,
  legalEntityDocument,
  legalEntityOnboardingProgress,
  user,
} from "@auction/db/schema";
import type { LegalEntityStatus, OrgOnboardingStepKey } from "@auction/types";
import { and, eq, sql } from "drizzle-orm";
import type { OrganizationOnboardingProfileInput } from "../services/organization-onboarding/org-onboarding-mappers.js";
import type {
  ILegalEntityOnboardingRepository,
  OnboardingAddressRow,
  OnboardingDbExecutor,
  OnboardingDocumentRow,
  OnboardingOrganisationRow,
} from "./interfaces/legal-entity-onboarding.repository.js";

export class DrizzleLegalEntityOnboardingRepository implements ILegalEntityOnboardingRepository {
  constructor(private readonly db: Database) {}

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
