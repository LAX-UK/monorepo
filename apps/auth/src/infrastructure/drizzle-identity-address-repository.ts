import type { AccountAddressDefaultKind, AccountAddressFields } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { identityAddress } from "@auction/identity-db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type {
  AddressCreateOutcome,
  AddressDeleteOutcome,
  AddressWriteOutcome,
  IIdentityAddressRepository,
  IdentityAddressRow,
} from "../services/identity-address.ports.js";

type Tx = Parameters<Parameters<IdentityDatabase["transaction"]>[0]>[0];

function toRow(row: typeof identityAddress.$inferSelect): IdentityAddressRow {
  return {
    id: row.id,
    subjectId: row.subjectId,
    label: row.label,
    recipientName: row.recipientName,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postcode: row.postcode,
    country: row.country,
    phone: row.phone,
    isDefaultShipping: row.isDefaultShipping,
    isDefaultBilling: row.isDefaultBilling,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const defaultColumn = {
  shipping: "isDefaultShipping",
  billing: "isDefaultBilling",
} as const satisfies Record<AccountAddressDefaultKind, keyof typeof identityAddress.$inferInsert>;

/**
 * Every write takes a per-person transaction lock first. The count behind the address limit and
 * the move of a default from one row to another are read-then-write, so without it two tabs could
 * exceed the limit or briefly leave two defaults (which the partial unique indexes would then
 * reject as an error instead of a clean answer).
 */
export class DrizzleIdentityAddressRepository implements IIdentityAddressRepository {
  constructor(private readonly db: IdentityDatabase) {}

  private async locked<T>(subjectId: string, run: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`identity_address:${subjectId}`}))`,
      );
      return run(tx);
    });
  }

  private async find(tx: Tx, subjectId: string, addressId: string) {
    const [row] = await tx
      .select()
      .from(identityAddress)
      .where(and(eq(identityAddress.subjectId, subjectId), eq(identityAddress.id, addressId)))
      .limit(1);
    return row ?? null;
  }

  async list(subjectId: string): Promise<IdentityAddressRow[]> {
    const rows = await this.db
      .select()
      .from(identityAddress)
      .where(eq(identityAddress.subjectId, subjectId))
      .orderBy(asc(identityAddress.createdAt), asc(identityAddress.id));
    return rows.map(toRow);
  }

  create(
    subjectId: string,
    fields: AccountAddressFields,
    limit: number,
  ): Promise<AddressCreateOutcome> {
    return this.locked(subjectId, async (tx) => {
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(identityAddress)
        .where(eq(identityAddress.subjectId, subjectId));
      if (count >= limit) return { ok: false, reason: "address_limit_reached" };
      const [row] = await tx
        .insert(identityAddress)
        .values({
          ...fields,
          subjectId,
          isDefaultShipping: count === 0,
          isDefaultBilling: count === 0,
        })
        .returning();
      if (!row) throw new Error("identity_address insert returned no row");
      return { ok: true, address: toRow(row) };
    });
  }

  update(
    subjectId: string,
    addressId: string,
    expectedVersion: number,
    fields: AccountAddressFields,
  ): Promise<AddressWriteOutcome> {
    return this.locked(subjectId, async (tx) => {
      const existing = await this.find(tx, subjectId, addressId);
      if (!existing) return { ok: false, reason: "address_not_found" };
      if (existing.version !== expectedVersion) return { ok: false, reason: "version_conflict" };
      const [row] = await tx
        .update(identityAddress)
        .set({ ...fields, version: existing.version + 1, updatedAt: new Date() })
        .where(eq(identityAddress.id, addressId))
        .returning();
      if (!row) throw new Error("identity_address update returned no row");
      return { ok: true, address: toRow(row) };
    });
  }

  delete(
    subjectId: string,
    addressId: string,
    expectedVersion: number,
  ): Promise<AddressDeleteOutcome> {
    return this.locked(subjectId, async (tx) => {
      const existing = await this.find(tx, subjectId, addressId);
      if (!existing) return { ok: false, reason: "address_not_found" };
      if (existing.version !== expectedVersion) return { ok: false, reason: "version_conflict" };
      await tx.delete(identityAddress).where(eq(identityAddress.id, addressId));
      const [oldest] = await tx
        .select({ id: identityAddress.id })
        .from(identityAddress)
        .where(eq(identityAddress.subjectId, subjectId))
        .orderBy(asc(identityAddress.createdAt), asc(identityAddress.id))
        .limit(1);
      if (oldest && (existing.isDefaultShipping || existing.isDefaultBilling)) {
        await tx
          .update(identityAddress)
          .set({
            ...(existing.isDefaultShipping ? { isDefaultShipping: true } : {}),
            ...(existing.isDefaultBilling ? { isDefaultBilling: true } : {}),
            version: sql`${identityAddress.version} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(identityAddress.id, oldest.id));
      }
      return { ok: true };
    });
  }

  setDefault(
    subjectId: string,
    addressId: string,
    kind: AccountAddressDefaultKind,
  ): Promise<AddressWriteOutcome> {
    return this.locked(subjectId, async (tx) => {
      const existing = await this.find(tx, subjectId, addressId);
      if (!existing) return { ok: false, reason: "address_not_found" };
      const column = defaultColumn[kind];
      if (existing[column]) return { ok: true, address: toRow(existing) };
      const now = new Date();
      await tx
        .update(identityAddress)
        .set({ [column]: false, version: sql`${identityAddress.version} + 1`, updatedAt: now })
        .where(and(eq(identityAddress.subjectId, subjectId), eq(identityAddress[column], true)));
      const [row] = await tx
        .update(identityAddress)
        .set({ [column]: true, version: sql`${identityAddress.version} + 1`, updatedAt: now })
        .where(eq(identityAddress.id, addressId))
        .returning();
      if (!row) throw new Error("identity_address default update returned no row");
      return { ok: true, address: toRow(row) };
    });
  }
}
