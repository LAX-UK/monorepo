import type { Database } from "@auction/db";
import { xeroConnection } from "@auction/db/schema";
import type { XeroTokenSealer } from "@auction/db/xero-token-sealing";
import { desc, eq } from "drizzle-orm";
import type {
  IXeroConnectionRepository,
  XeroConnectionInsert,
  XeroConnectionRow,
} from "../interfaces/xero.repository.js";

type StoredConnection = typeof xeroConnection.$inferSelect;

/**
 * Xero OAuth tokens are sealed here and nowhere else: callers pass and receive plaintext tokens,
 * the table only ever receives envelopes, and the legacy plaintext columns are always written null.
 */
export class DrizzleXeroConnectionRepository implements IXeroConnectionRepository {
  constructor(
    private readonly db: Database,
    private readonly sealer: XeroTokenSealer,
  ) {}

  private open(stored: StoredConnection): XeroConnectionRow {
    const { accessToken, refreshToken, accessTokenSealed, refreshTokenSealed, ...rest } = stored;
    return {
      ...rest,
      ...this.sealer.open({ accessToken, refreshToken, accessTokenSealed, refreshTokenSealed }),
    };
  }

  async findLatest(): Promise<XeroConnectionRow | null> {
    const [row] = await this.db
      .select()
      .from(xeroConnection)
      .orderBy(desc(xeroConnection.updatedAt))
      .limit(1);
    return row ? this.open(row) : null;
  }

  async upsertConnection(
    row: Omit<XeroConnectionInsert, "id" | "createdAt" | "updatedAt">,
  ): Promise<XeroConnectionRow> {
    const now = new Date();
    const { accessToken, refreshToken, ...rest } = row;
    const sealed = this.sealer.seal({ accessToken, refreshToken });
    const [out] = await this.db
      .insert(xeroConnection)
      .values({
        ...rest,
        ...sealed,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: xeroConnection.tenantId,
        set: {
          tenantName: row.tenantName,
          ...sealed,
          expiresAt: row.expiresAt,
          scopes: row.scopes,
          connectedByUserId: row.connectedByUserId,
          connectionStatus: "healthy",
          lastRefreshError: null,
          updatedAt: now,
        },
      })
      .returning();
    if (!out) throw new Error("xero_connection upsert failed");
    return this.open(out);
  }

  async updateTokens(
    tenantId: string,
    patch: Pick<XeroConnectionRow, "accessToken" | "refreshToken" | "expiresAt">,
  ): Promise<void> {
    await this.db
      .update(xeroConnection)
      .set({
        ...this.sealer.seal(patch),
        expiresAt: patch.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(xeroConnection.tenantId, tenantId));
  }

  async updateConnectionStatus(
    tenantId: string,
    status: XeroConnectionRow["connectionStatus"],
    lastRefreshError: string | null,
  ): Promise<void> {
    await this.db
      .update(xeroConnection)
      .set({
        connectionStatus: status,
        lastRefreshError,
        updatedAt: new Date(),
      })
      .where(eq(xeroConnection.tenantId, tenantId));
  }

  async updateOrgMetadata(
    tenantId: string,
    patch: Pick<XeroConnectionRow, "orgShortCode" | "orgBaseCurrency">,
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
