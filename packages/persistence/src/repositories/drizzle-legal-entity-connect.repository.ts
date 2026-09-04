import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  kycVerification,
  legalEntity,
  legalEntityAddress,
  userAddress,
} from "@auction/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { ILegalEntityConnectReader } from "../interfaces/legal-entity-connect.reader.js";
import type { ILegalEntityConnectRepository } from "../interfaces/legal-entity-connect.repository.js";
import { pickEntityAddress, pickUserAddress } from "../lib/legal-entity-connect.helpers.js";
import type {
  ApplyConnectStatusTransitionInput,
  ConnectAccountCreationContextRow,
  ConnectKycSnapshot,
  LegalEntityConnectRow,
  PersistConnectAccountInput,
  StripeConnectFlagPatch,
} from "../lib/legal-entity-connect.types.js";

export class DrizzleLegalEntityConnectRepository
  implements ILegalEntityConnectReader, ILegalEntityConnectRepository
{
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): ILegalEntityConnectRepository {
    return new DrizzleLegalEntityConnectRepository(conn);
  }

  async findLegalEntityRowById(id: string): Promise<LegalEntityConnectRow | null> {
    const [row] = await this.db.select().from(legalEntity).where(eq(legalEntity.id, id)).limit(1);
    return row ?? null;
  }

  async findLegalEntityRowByStripeAccountId(
    stripeAccountId: string,
  ): Promise<LegalEntityConnectRow | null> {
    const [row] = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.stripeConnectAccountId, stripeAccountId))
      .limit(1);
    return row ?? null;
  }

  async loadAccountCreationContext(
    legalEntityId: string,
  ): Promise<ConnectAccountCreationContextRow | null> {
    const entityRows = await this.db
      .select({
        entity: legalEntity,
        ownerEmail: bidIdentityDirectory.email,
        ownerFirstName: bidUserProfile.firstName,
        ownerLastName: bidUserProfile.lastName,
        ownerDisplayName: bidIdentityDirectory.name,
        ownerKycStatus: bidUserProfile.kycStatus,
        ownerMobile: bidUserProfile.mobile,
        ownerUserId: bidIdentityDirectory.subjectId,
      })
      .from(legalEntity)
      .innerJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, legalEntity.createdByUserId),
      )
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, legalEntity.createdByUserId))
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    const entityRow = entityRows[0];
    if (!entityRow) return null;

    const [entityAddresses, userAddresses, kycRows] = await Promise.all([
      this.db
        .select({
          line1: legalEntityAddress.line1,
          line2: legalEntityAddress.line2,
          city: legalEntityAddress.city,
          state: legalEntityAddress.state,
          postalCode: legalEntityAddress.postalCode,
          country: legalEntityAddress.country,
          addressType: legalEntityAddress.addressType,
          isDefault: legalEntityAddress.isDefault,
        })
        .from(legalEntityAddress)
        .where(eq(legalEntityAddress.legalEntityId, legalEntityId)),
      this.db
        .select({
          line1: userAddress.line1,
          line2: userAddress.line2,
          city: userAddress.city,
          state: userAddress.state,
          postalCode: userAddress.postalCode,
          country: userAddress.country,
          addressType: userAddress.addressType,
          isDefault: userAddress.isDefault,
        })
        .from(userAddress)
        .where(eq(userAddress.userId, entityRow.ownerUserId)),
      this.db
        .select({
          verifiedFirstName: kycVerification.verifiedFirstName,
          verifiedLastName: kycVerification.verifiedLastName,
          verifiedDateOfBirth: kycVerification.verifiedDateOfBirth,
          verifiedIdCountry: kycVerification.verifiedIdCountry,
        })
        .from(kycVerification)
        .where(
          and(
            eq(kycVerification.userId, entityRow.ownerUserId),
            eq(kycVerification.status, "verified"),
          ),
        )
        .orderBy(desc(kycVerification.decisionAt), desc(kycVerification.createdAt))
        .limit(1),
    ]);

    const kycRow = kycRows[0];
    const kyc: ConnectKycSnapshot | null = kycRow
      ? {
          verifiedFirstName: kycRow.verifiedFirstName ?? null,
          verifiedLastName: kycRow.verifiedLastName ?? null,
          verifiedDateOfBirth: kycRow.verifiedDateOfBirth ?? null,
          verifiedIdCountry: kycRow.verifiedIdCountry ?? null,
        }
      : null;

    return {
      entity: entityRow.entity,
      ownerUserId: entityRow.ownerUserId,
      ownerEmail: entityRow.ownerEmail,
      ownerFirstName: entityRow.ownerFirstName,
      ownerLastName: entityRow.ownerLastName,
      ownerDisplayName: entityRow.ownerDisplayName,
      ownerKycStatus: entityRow.ownerKycStatus,
      ownerMobile: entityRow.ownerMobile,
      entityAddress: pickEntityAddress(entityAddresses),
      userAddress: pickUserAddress(userAddresses),
      kyc,
    };
  }

  async persistConnectAccount(
    input: PersistConnectAccountInput,
  ): Promise<LegalEntityConnectRow | null> {
    const [updated] = await this.db
      .update(legalEntity)
      .set({
        stripeConnectAccountId: input.stripeAccountId,
        ...(input.promoteLeadToConnectPending
          ? { status: "connect_pending" as const, statusChangedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(legalEntity.id, input.legalEntityId))
      .returning();
    return updated ?? null;
  }

  async updateStripeConnectFlags(
    legalEntityId: string,
    flags: StripeConnectFlagPatch,
    db: Database = this.db,
  ): Promise<void> {
    await db
      .update(legalEntity)
      .set({
        ...flags,
        updatedAt: new Date(),
      })
      .where(eq(legalEntity.id, legalEntityId));
  }

  async applyConnectStatusTransition(
    input: ApplyConnectStatusTransitionInput,
    db: Database = this.db,
  ): Promise<LegalEntityConnectRow | null> {
    const [updated] = await db
      .update(legalEntity)
      .set({
        ...input.flags,
        status: input.nextStatus,
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(legalEntity.id, input.legalEntityId), eq(legalEntity.status, input.expectedStatus)),
      )
      .returning();
    return updated ?? null;
  }

  async applyDeauthorized(stripeAccountId: string, db: Database = this.db) {
    const [row] = await db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.stripeConnectAccountId, stripeAccountId))
      .limit(1);
    if (!row) return null;

    const nextStatus =
      !row.isLaxManaged && row.status === "approved" ? ("connect_pending" as const) : row.status;

    const [updated] = await db
      .update(legalEntity)
      .set({
        stripeConnectPayoutsEnabled: false,
        stripeConnectChargesEnabled: false,
        stripeConnectDisabledReason: "platform_deauthorized",
        stripeConnectRequirementsCurrentlyDue: [],
        stripeConnectRequirementsErrors: [],
        ...(nextStatus !== row.status ? { status: nextStatus, statusChangedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(legalEntity.id, row.id))
      .returning();
    return updated ?? null;
  }
}
