import type { Database } from "@auction/db";
import { legalEntity, legalEntityAddress, legalEntityMember, user } from "@auction/db/schema";
import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import { and, desc, eq, inArray, isNotNull, isNull, notInArray, or } from "drizzle-orm";
import type {
  ActiveMembership,
  ILegalEntityRepository,
} from "../services/interfaces/legal-entity-repository.js";

function rowToEntity(row: typeof legalEntity.$inferSelect): LegalEntity {
  return {
    id: row.id,
    displayName: row.displayName,
    legalName: row.legalName ?? null,
    slug: row.slug ?? null,
    kind: row.kind,
    subkind: row.subkind,
    createdByUserId: row.createdByUserId,
    status: row.status,
    statusChangedAt: row.statusChangedAt ?? null,
    statusChangedByUserId: row.statusChangedByUserId ?? null,
    statusReason: row.statusReason ?? null,
    stripeConnectAccountId: row.stripeConnectAccountId ?? null,
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeConnectChargesEnabled: row.stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled: row.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue ?? [],
    stripeConnectDisabledReason: row.stripeConnectDisabledReason ?? null,
    xeroContactId: row.xeroContactId ?? null,
    vatNumber: row.vatNumber ?? null,
    marginSchemeEligible: row.marginSchemeEligible,
    isLaxManaged: row.isLaxManaged,
    platformFeeBps: row.platformFeeBps ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleLegalEntityRepository implements ILegalEntityRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<LegalEntity | null> {
    const rows = await this.db.select().from(legalEntity).where(eq(legalEntity.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return rowToEntity(row);
  }

  async listActiveMembershipsForUser(userId: string): Promise<LegalEntitySummary[]> {
    const rows = await this.db
      .select({
        id: legalEntity.id,
        displayName: legalEntity.displayName,
        kind: legalEntity.kind,
        subkind: legalEntity.subkind,
        status: legalEntity.status,
        statusReason: legalEntity.statusReason,
        role: legalEntityMember.role,
        isPrimaryAdmin: legalEntityMember.isPrimaryAdmin,
      })
      .from(legalEntityMember)
      .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
      .where(
        and(
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          notInArray(legalEntity.status, ["archived"]),
        ),
      );
    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      kind: r.kind,
      subkind: r.subkind,
      status: r.status,
      statusReason: r.statusReason ?? null,
      role: r.role,
      isPrimaryAdmin: r.isPrimaryAdmin,
    }));
  }

  async setXeroContactId(legalEntityId: string, xeroContactId: string): Promise<void> {
    await this.db
      .update(legalEntity)
      .set({ xeroContactId, updatedAt: new Date() })
      .where(eq(legalEntity.id, legalEntityId));
  }

  async setStripeCustomerId(legalEntityId: string, stripeCustomerId: string): Promise<void> {
    await this.db
      .update(legalEntity)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(legalEntity.id, legalEntityId));
  }

  async findPreferredBillToLegalEntityAddress(legalEntityId: string): Promise<{
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
    addressType: string;
  } | null> {
    const typeOrder: Record<string, number> = {
      billing: 0,
      both: 1,
      registered_office: 2,
    };
    const rows = await this.db
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
      .where(eq(legalEntityAddress.legalEntityId, legalEntityId));
    if (rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => {
      const oa = typeOrder[a.addressType] ?? 99;
      const ob = typeOrder[b.addressType] ?? 99;
      if (oa !== ob) return oa - ob;
      return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0);
    });
    const r = sorted[0];
    if (!r) return null;
    return {
      line1: r.line1,
      line2: r.line2 ?? null,
      city: r.city,
      state: r.state ?? null,
      postalCode: r.postalCode,
      country: r.country,
      addressType: r.addressType,
    };
  }

  async findPrimaryAddressForXero(legalEntityId: string): Promise<{
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
  } | null> {
    const rows = await this.db
      .select({
        line1: legalEntityAddress.line1,
        line2: legalEntityAddress.line2,
        city: legalEntityAddress.city,
        state: legalEntityAddress.state,
        postalCode: legalEntityAddress.postalCode,
        country: legalEntityAddress.country,
        isDefault: legalEntityAddress.isDefault,
      })
      .from(legalEntityAddress)
      .where(eq(legalEntityAddress.legalEntityId, legalEntityId))
      .orderBy(desc(legalEntityAddress.isDefault), legalEntityAddress.createdAt)
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      line1: r.line1,
      line2: r.line2 ?? null,
      city: r.city,
      state: r.state ?? null,
      postalCode: r.postalCode,
      country: r.country,
    };
  }

  async findActiveMembership(
    userId: string,
    legalEntityId: string,
  ): Promise<ActiveMembership | null> {
    const rows = await this.db
      .select({
        legalEntityId: legalEntityMember.legalEntityId,
        userId: legalEntityMember.userId,
        role: legalEntityMember.role,
        isPrimaryAdmin: legalEntityMember.isPrimaryAdmin,
      })
      .from(legalEntityMember)
      .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
      .where(
        and(
          eq(legalEntityMember.userId, userId),
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          notInArray(legalEntity.status, ["archived"]),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async listImpersonationNoticeRecipientEmails(
    legalEntityId: string,
  ): Promise<{ email: string; userId: string }[]> {
    const rows = await this.db
      .selectDistinct({ email: user.email, userId: user.id })
      .from(legalEntityMember)
      .innerJoin(user, eq(user.id, legalEntityMember.userId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          or(
            inArray(legalEntityMember.role, ["owner", "admin"]),
            eq(legalEntityMember.isPrimaryAdmin, true),
          ),
        ),
      );
    return rows;
  }

  /** The personal entity is the `individual`/`private_collector` row created
   * by the legal-entity backfill (one per user). Returns it as a summary for the
   * switcher; throws if the backfill row is missing (should never happen
   * post-0027).
   */
  async ensurePersonalEntity(userId: string): Promise<LegalEntitySummary> {
    const rows = await this.db
      .select({
        id: legalEntity.id,
        displayName: legalEntity.displayName,
        kind: legalEntity.kind,
        subkind: legalEntity.subkind,
        status: legalEntity.status,
        role: legalEntityMember.role,
        isPrimaryAdmin: legalEntityMember.isPrimaryAdmin,
      })
      .from(legalEntity)
      .innerJoin(
        legalEntityMember,
        and(
          eq(legalEntityMember.legalEntityId, legalEntity.id),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      )
      .where(and(eq(legalEntity.kind, "individual"), eq(legalEntity.createdByUserId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(
        `personal_entity_missing: user ${userId} has no individual legal entity (0027 backfill missing?)`,
      );
    }
    return row;
  }
}
