import { randomBytes } from "node:crypto";
import { createDb } from "@auction/db";
import { xeroConnection } from "@auction/db/schema";
import {
  type XeroTokenQueryable,
  XeroTokenSealer,
  backfillXeroTokenSealing,
} from "@auction/db/xero-token-sealing";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleXeroConnectionRepository } from "./drizzle-xero-connection.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleXeroConnectionRepository token sealing (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const sealer = XeroTokenSealer.fromKey(randomBytes(32).toString("hex"));
  const repo = new DrizzleXeroConnectionRepository(db, sealer);
  const tenantId = `seal-it-${Date.now().toString(36)}`;
  const expiresAt = new Date("2030-01-01T00:00:00.000Z");

  const stored = async () => {
    const [row] = await db
      .select()
      .from(xeroConnection)
      .where(eq(xeroConnection.tenantId, tenantId));
    return row;
  };

  beforeEach(async () => {
    await db.delete(xeroConnection).where(eq(xeroConnection.tenantId, tenantId));
  });
  afterAll(async () => {
    await db.delete(xeroConnection).where(eq(xeroConnection.tenantId, tenantId));
  });

  it("never writes a token in the clear: not on connect, not on refresh, not on reconnect", async () => {
    const connected = await repo.upsertConnection({
      tenantId,
      tenantName: "Org",
      accessToken: "ACCESS-1",
      refreshToken: "REFRESH-1",
      expiresAt,
      scopes: "a b",
      connectedByUserId: null,
      connectionStatus: "healthy",
      lastRefreshError: null,
      orgShortCode: null,
      orgBaseCurrency: null,
    });
    expect(connected.accessToken).toBe("ACCESS-1");

    const afterConnect = await stored();
    expect(afterConnect?.accessToken).toBeNull();
    expect(afterConnect?.refreshToken).toBeNull();
    expect(afterConnect?.accessTokenSealed).toMatch(/^v1:/);

    await repo.updateTokens(tenantId, {
      accessToken: "ACCESS-2",
      refreshToken: "REFRESH-2",
      expiresAt,
    });
    const afterRefresh = await stored();
    expect(afterRefresh?.accessToken).toBeNull();
    expect(afterRefresh?.refreshToken).toBeNull();
    expect(JSON.stringify(afterRefresh)).not.toMatch(/ACCESS-|REFRESH-/);
    expect(await repo.findLatest()).toMatchObject({
      tenantId,
      accessToken: "ACCESS-2",
      refreshToken: "REFRESH-2",
    });

    await repo.upsertConnection({
      tenantId,
      accessToken: "ACCESS-3",
      refreshToken: "REFRESH-3",
      expiresAt,
    });
    const afterReconnect = await stored();
    expect(afterReconnect?.accessToken).toBeNull();
    expect(JSON.stringify(afterReconnect)).not.toMatch(/ACCESS-|REFRESH-/);
  });

  it("reads a legacy plaintext row until it is backfilled, then reads the sealed copy", async () => {
    await db.insert(xeroConnection).values({
      tenantId,
      accessToken: "LEGACY-A",
      refreshToken: "LEGACY-R",
      expiresAt,
    });
    expect(await repo.findLatest()).toMatchObject({ accessToken: "LEGACY-A" });

    const pool = (db as unknown as { $client: XeroTokenQueryable }).$client;
    expect(await backfillXeroTokenSealing(pool, sealer)).toMatchObject({ skipped: 0 });
    const row = await stored();
    expect(row?.accessToken).toBeNull();
    expect(await repo.findLatest()).toMatchObject({
      accessToken: "LEGACY-A",
      refreshToken: "LEGACY-R",
    });
  });

  it("serves a newer plaintext write from a pre-sealing release, not the stale sealed copy", async () => {
    await repo.upsertConnection({
      tenantId,
      accessToken: "OLD-A",
      refreshToken: "OLD-R",
      expiresAt,
    });
    await db
      .update(xeroConnection)
      .set({ accessToken: "NEW-A", refreshToken: "NEW-R", updatedAt: new Date() })
      .where(eq(xeroConnection.tenantId, tenantId));
    expect(await repo.findLatest()).toMatchObject({ accessToken: "NEW-A", refreshToken: "NEW-R" });
  });

  it("refuses to read a legacy row without a key, so no refresh can be attempted", async () => {
    await db.insert(xeroConnection).values({
      tenantId,
      accessToken: "LEGACY-A",
      refreshToken: "LEGACY-R",
      expiresAt,
    });
    const keyless = new DrizzleXeroConnectionRepository(db, XeroTokenSealer.unavailable());
    await expect(keyless.findLatest()).rejects.toThrow(/key_missing/);
  });

  it("rejects a sealed column that is not an envelope", async () => {
    const error = await db
      .insert(xeroConnection)
      .values({ tenantId, accessTokenSealed: "raw-token", refreshTokenSealed: "v1:ok", expiresAt })
      .then(
        () => null,
        (e: unknown) => e as { cause?: { constraint?: string } },
      );
    expect(error?.cause?.constraint).toBe("xero_connection_access_token_sealed_envelope_chk");
  });

  it("refuses to write when no key is configured, leaving the stored row unchanged", async () => {
    const keyless = new DrizzleXeroConnectionRepository(db, XeroTokenSealer.unavailable());
    await expect(
      keyless.upsertConnection({ tenantId, accessToken: "x", refreshToken: "y", expiresAt }),
    ).rejects.toThrow(/key_missing/);
    expect(await stored()).toBeUndefined();
  });
});
