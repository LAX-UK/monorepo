import type { Database } from "@auction/db";
import { userAddress } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  CreateAddressInput,
  IAddressRepository,
  UpdateAddressInput,
  UserAddressRow,
} from "../services/interfaces/profile.js";

function mapRow(r: typeof userAddress.$inferSelect): UserAddressRow {
  return {
    id: r.id,
    userId: r.userId,
    label: r.label,
    line1: r.line1,
    line2: r.line2 ?? null,
    city: r.city,
    state: r.state ?? null,
    postalCode: r.postalCode,
    country: r.country,
    isDefault: r.isDefault,
    createdAt: r.createdAt,
  };
}

export class DrizzleAddressRepository implements IAddressRepository {
  constructor(private readonly db: Database) {}

  async listByUser(userId: string): Promise<UserAddressRow[]> {
    const rows = await this.db.select().from(userAddress).where(eq(userAddress.userId, userId));
    return rows.map(mapRow);
  }

  async findByIdForUser(userId: string, addressId: string): Promise<UserAddressRow | null> {
    const [row] = await this.db
      .select()
      .from(userAddress)
      .where(and(eq(userAddress.userId, userId), eq(userAddress.id, addressId)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async create(userId: string, input: CreateAddressInput): Promise<UserAddressRow> {
    const isDefault = input.isDefault ?? false;
    if (isDefault) await this.clearDefaultForUser(userId);
    const [row] = await this.db
      .insert(userAddress)
      .values({
        userId,
        label: input.label,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state ?? null,
        postalCode: input.postalCode,
        country: input.country,
        isDefault,
      })
      .returning();
    if (!row) throw new Error("Insert failed");
    return mapRow(row);
  }

  async update(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<UserAddressRow | null> {
    const existing = await this.findByIdForUser(userId, addressId);
    if (!existing) return null;
    const patch: Partial<typeof userAddress.$inferInsert> = {};
    if (input.label !== undefined) patch.label = input.label;
    if (input.line1 !== undefined) patch.line1 = input.line1;
    if (input.line2 !== undefined) patch.line2 = input.line2 ?? null;
    if (input.city !== undefined) patch.city = input.city;
    if (input.state !== undefined) patch.state = input.state ?? null;
    if (input.postalCode !== undefined) patch.postalCode = input.postalCode;
    if (input.country !== undefined) patch.country = input.country;
    if (input.isDefault !== undefined) patch.isDefault = input.isDefault;
    if (input.isDefault === true) await this.clearDefaultForUser(userId);
    await this.db
      .update(userAddress)
      .set(patch)
      .where(and(eq(userAddress.userId, userId), eq(userAddress.id, addressId)));
    if (input.isDefault === true) {
      await this.db
        .update(userAddress)
        .set({ isDefault: true })
        .where(and(eq(userAddress.userId, userId), eq(userAddress.id, addressId)));
    }
    return this.findByIdForUser(userId, addressId);
  }

  async delete(userId: string, addressId: string): Promise<boolean> {
    const res = await this.db
      .delete(userAddress)
      .where(and(eq(userAddress.userId, userId), eq(userAddress.id, addressId)))
      .returning({ id: userAddress.id });
    return res.length > 0;
  }

  async clearDefaultForUser(userId: string): Promise<void> {
    await this.db
      .update(userAddress)
      .set({ isDefault: false })
      .where(eq(userAddress.userId, userId));
  }

  async setDefault(userId: string, addressId: string): Promise<void> {
    await this.clearDefaultForUser(userId);
    await this.db
      .update(userAddress)
      .set({ isDefault: true })
      .where(and(eq(userAddress.userId, userId), eq(userAddress.id, addressId)));
  }
}
