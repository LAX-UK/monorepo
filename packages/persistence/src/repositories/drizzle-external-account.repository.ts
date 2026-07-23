import type { Database } from "@auction/db";
import { externalAccount } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  ExternalAccountRow,
  IExternalAccountRepository,
  UpsertExternalAccountInput,
} from "../interfaces/external-account.repository.js";

function mapRow(row: typeof externalAccount.$inferSelect): ExternalAccountRow {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    externalId: row.externalId,
    email: row.email ?? null,
    linkedAt: row.linkedAt,
  };
}

export class DrizzleExternalAccountRepository implements IExternalAccountRepository {
  constructor(private readonly db: Database) {}

  async findByProviderExternalId(
    provider: string,
    externalId: string,
  ): Promise<ExternalAccountRow | null> {
    const [row] = await this.db
      .select()
      .from(externalAccount)
      .where(
        and(eq(externalAccount.provider, provider), eq(externalAccount.externalId, externalId)),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async upsert(
    input: UpsertExternalAccountInput,
    tx?: Database,
  ): Promise<{ inserted: boolean; row: ExternalAccountRow }> {
    const conn = tx ?? this.db;
    const [existingRow] = await conn
      .select()
      .from(externalAccount)
      .where(
        and(
          eq(externalAccount.provider, input.provider),
          eq(externalAccount.externalId, input.externalId),
        ),
      )
      .limit(1);
    const existing = existingRow ? mapRow(existingRow) : null;
    if (existing) {
      const [updated] = await conn
        .update(externalAccount)
        .set({
          userId: input.userId,
          email: input.email ?? existing.email,
          metadata: input.metadata ?? undefined,
        })
        .where(eq(externalAccount.id, existing.id))
        .returning();
      if (!updated) throw new Error("Failed to update external account");
      return { inserted: false, row: mapRow(updated) };
    }

    const [inserted] = await conn
      .insert(externalAccount)
      .values({
        userId: input.userId,
        provider: input.provider,
        externalId: input.externalId,
        email: input.email ?? null,
        metadata: input.metadata ?? {},
      })
      .returning();
    if (!inserted) throw new Error("Failed to insert external account");
    return { inserted: true, row: mapRow(inserted) };
  }
}
