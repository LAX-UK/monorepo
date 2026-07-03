import type { Database } from "@auction/db";
import { legalEntity, legalEntityAddress } from "@auction/db/schema";
import type { LegalEntity } from "@auction/types";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";
import type { ILegalEntityReader } from "../interfaces/legal-entity.reader.js";
import { legalEntityRowToDomain } from "../lib/legal-entity-row-mapper.js";

export class DrizzleLegalEntityReader implements ILegalEntityReader {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<LegalEntity | null> {
    const rows = await this.db.select().from(legalEntity).where(eq(legalEntity.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return legalEntityRowToDomain(row);
  }

  async findByIds(ids: readonly string[]): Promise<LegalEntity[]> {
    const unique = [...new Set(ids.filter((id) => id.length > 0))];
    if (unique.length === 0) return [];
    const rows = await this.db.select().from(legalEntity).where(inArray(legalEntity.id, unique));
    return rows.map(legalEntityRowToDomain);
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

  async advanceIndividualLeadsToConnectPendingAfterKyc(
    userId: string,
    tx: DbTransaction,
  ): Promise<{ id: string }[]> {
    const bumped = await tx
      .update(legalEntity)
      .set({
        status: "connect_pending",
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(legalEntity.createdByUserId, userId),
          eq(legalEntity.kind, "individual"),
          eq(legalEntity.status, "lead"),
        ),
      )
      .returning({ id: legalEntity.id });
    return bumped;
  }
}
