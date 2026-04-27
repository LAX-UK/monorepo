import type { Database } from "@auction/db";
import { xeroConnection } from "@auction/db/schema";
import { desc, eq } from "drizzle-orm";
import type {
  IXeroConnectionRepository,
  XeroConnectionInsert,
  XeroConnectionRow,
} from "../services/interfaces/xero-repositories.js";

export class DrizzleXeroConnectionRepository implements IXeroConnectionRepository {
  constructor(private readonly db: Database) {}

  async findLatest(): Promise<XeroConnectionRow | null> {
    const [row] = await this.db
      .select()
      .from(xeroConnection)
      .orderBy(desc(xeroConnection.updatedAt))
      .limit(1);
    return row ?? null;
  }

  async upsertConnection(
    row: Omit<XeroConnectionInsert, "id" | "createdAt" | "updatedAt">,
  ): Promise<XeroConnectionRow> {
    const now = new Date();
    const [out] = await this.db
      .insert(xeroConnection)
      .values({
        ...row,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: xeroConnection.tenantId,
        set: {
          tenantName: row.tenantName,
          accessToken: row.accessToken,
          refreshToken: row.refreshToken,
          expiresAt: row.expiresAt,
          scopes: row.scopes,
          connectedByUserId: row.connectedByUserId,
          updatedAt: now,
        },
      })
      .returning();
    if (!out) throw new Error("xero_connection upsert failed");
    return out;
  }

  async updateTokens(
    tenantId: string,
    patch: Pick<XeroConnectionRow, "accessToken" | "refreshToken" | "expiresAt">,
  ): Promise<void> {
    await this.db
      .update(xeroConnection)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(xeroConnection.tenantId, tenantId));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(xeroConnection);
  }
}
